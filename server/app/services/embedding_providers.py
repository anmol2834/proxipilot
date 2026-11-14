"""Embedding Provider Implementations for ProxiPilot.

Implements the EmbeddingProvider protocol for:
1. Voyage AI (voyage-4-large / voyage-3-large)
2. Cohere (embed-multilingual-v3.0 / embed-v4)
3. OpenAI (text-embedding-3-small / text-embedding-3-large)
4. LocalDeterministic (Fast, offline, unit-normalized vectors for testing & air-gapped CI)

Design:
- Completely decoupled from proprietary vendor SDKs; uses persistent httpx.AsyncClient.
- Bounded batching, exponential backoff with jitter, timeout protection.
- Strict L2 unit normalization enforcement.
"""

import asyncio
import functools
import hashlib
import math
import random
import time
from typing import Any, Dict, List, Optional
import httpx

from app.contracts.embeddings import (
    EmbeddingBatchRequest,
    EmbeddingBatchResult,
    EmbeddingDtype,
    EmbeddingInputType,
    EmbeddingProvider,
    EmbeddingRequestItem,
    EmbeddingResultItem,
    NormalizationPolicy,
)
from app.core.config import EmbeddingSettings, get_settings
from app.core.logging import logger


try:  # NumPy accelerates the local deterministic provider; optional at runtime.
    import numpy as _np
except Exception:  # pragma: no cover - fallback path
    _np = None


@functools.lru_cache(maxsize=200_000)
def _token_pattern_cached(tok: str, dimension: int):
    """Per-token contribution pattern (before positional weighting) for the local provider."""
    h = _np.frombuffer(hashlib.sha256(tok.encode("utf-8")).digest(), dtype=_np.uint8)
    groups = dimension // 4
    w = (h[_np.arange(groups) % len(h)].astype(_np.float64) - 128.0) / 128.0
    pattern = _np.empty(dimension, dtype=_np.float64)
    pattern[0::4] = w
    pattern[1::4] = _np.sin(w * math.pi)
    pattern[2::4] = _np.cos(w * math.pi)
    pattern[3::4] = w * w - 0.5
    pattern.setflags(write=False)
    return pattern


def _l2_normalize(vec: List[float]) -> List[float]:
    """Normalize a vector to unit length (Euclidean L2 norm = 1.0)."""
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0.0 or math.isnan(norm):
        return vec
    return [x / norm for x in vec]


# ============================================================================
# 1. Voyage AI Provider
# ============================================================================


class VoyageEmbeddingProvider(EmbeddingProvider):
    """Voyage AI Embedding Provider.

    Official Model: voyage-4-large (or voyage-3-large).
    Dimension: 1024 (default) or 1536.
    Supports asymmetric input types ('document' vs 'query').
    """

    def __init__(self, settings: Optional[EmbeddingSettings] = None):
        self._settings = settings or get_settings().embedding
        self._api_key = self._settings.voyage_api_key
        self._model_name = self._settings.model_name or "voyage-4-large"
        self._model_version = self._settings.model_version or "2026-v1"
        self._dimension = self._settings.dimension or 1024
        self._endpoint = "https://api.voyageai.com/v1/embeddings"
        self._timeout = self._settings.request_timeout_seconds
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def model_version(self) -> str:
        return self._model_version

    @property
    def dimension(self) -> int:
        return self._dimension

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def embed_batch(self, request: EmbeddingBatchRequest) -> EmbeddingBatchResult:
        if not request.items:
            return EmbeddingBatchResult(
                results=[],
                model_name=self._model_name,
                model_version=self._model_version,
                dimension=self._dimension,
                normalization=request.normalization,
                dtype=request.dtype,
            )

        client = await self._get_client()
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        input_type_val = "document" if request.input_type == EmbeddingInputType.DOCUMENT else "query"

        texts = [it.text for it in request.items]
        payload: Dict[str, Any] = {
            "model": request.model_name or self._model_name,
            "input": texts,
            "input_type": input_type_val,
        }
        if self._dimension:
            payload["output_dimension"] = self._dimension

        start_t = time.perf_counter()
        retries = self._settings.max_retries
        backoff = 0.5

        for attempt in range(retries + 1):
            try:
                resp = await client.post(self._endpoint, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_data = data.get("data", [])
                    total_tokens = data.get("usage", {}).get("total_tokens", 0)

                    results: List[EmbeddingResultItem] = []
                    for idx, it in enumerate(request.items):
                        vec = raw_data[idx]["embedding"]
                        if request.normalization == NormalizationPolicy.L2:
                            vec = _l2_normalize(vec)
                        results.append(
                            EmbeddingResultItem(
                                item_id=it.item_id,
                                vector=vec,
                                dimension=len(vec),
                                content_hash=it.content_hash,
                            )
                        )
                    latency_ms = (time.perf_counter() - start_t) * 1000.0
                    return EmbeddingBatchResult(
                        results=results,
                        model_name=payload["model"],
                        model_version=self._model_version,
                        dimension=self._dimension,
                        normalization=request.normalization,
                        dtype=request.dtype,
                        total_tokens=total_tokens,
                        latency_ms=latency_ms,
                    )
                elif resp.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                    jitter = random.uniform(0.1, 0.3)
                    await asyncio.sleep(backoff + jitter)
                    backoff *= 2.0
                    continue
                else:
                    resp.raise_for_status()
            except httpx.HTTPError as err:
                if attempt >= retries:
                    logger.error("Voyage embedding failed after retries", error=str(err))
                    raise
                jitter = random.uniform(0.1, 0.3)
                await asyncio.sleep(backoff + jitter)
                backoff *= 2.0

        raise RuntimeError("Failed to generate Voyage embeddings after retries")

    async def embed_single(
        self,
        text: str,
        input_type: EmbeddingInputType = EmbeddingInputType.DOCUMENT,
    ) -> List[float]:
        req = EmbeddingBatchRequest(
            items=[
                EmbeddingRequestItem(
                    item_id="single",
                    text=text,
                    content_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                )
            ],
            input_type=input_type,
        )
        res = await self.embed_batch(req)
        return res.results[0].vector


# ============================================================================
# 2. Cohere Provider
# ============================================================================


class CohereEmbeddingProvider(EmbeddingProvider):
    """Cohere Embedding Provider.

    Official Model: embed-multilingual-v3.0 or embed-v4.
    Dimension: 1024.
    Supports input types: 'search_document' vs 'search_query'.
    """

    def __init__(self, settings: Optional[EmbeddingSettings] = None):
        self._settings = settings or get_settings().embedding
        self._api_key = self._settings.cohere_api_key
        self._model_name = self._settings.model_name or "embed-multilingual-v3.0"
        self._model_version = self._settings.model_version or "2026-v1"
        self._dimension = self._settings.dimension or 1024
        self._endpoint = "https://api.cohere.com/v2/embed"
        self._timeout = self._settings.request_timeout_seconds
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def model_version(self) -> str:
        return self._model_version

    @property
    def dimension(self) -> int:
        return self._dimension

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def embed_batch(self, request: EmbeddingBatchRequest) -> EmbeddingBatchResult:
        if not request.items:
            return EmbeddingBatchResult(
                results=[],
                model_name=self._model_name,
                model_version=self._model_version,
                dimension=self._dimension,
                normalization=request.normalization,
                dtype=request.dtype,
            )

        client = await self._get_client()
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        input_type_val = (
            "search_document"
            if request.input_type == EmbeddingInputType.DOCUMENT
            else "search_query"
        )
        texts = [it.text for it in request.items]
        payload: Dict[str, Any] = {
            "model": request.model_name or self._model_name,
            "texts": texts,
            "input_type": input_type_val,
            "embedding_types": ["float"],
        }

        start_t = time.perf_counter()
        retries = self._settings.max_retries
        backoff = 0.5

        for attempt in range(retries + 1):
            try:
                resp = await client.post(self._endpoint, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_embeddings = data.get("embeddings", {}).get("float", [])
                    total_tokens = data.get("meta", {}).get("billed_units", {}).get("input_tokens", 0)

                    results: List[EmbeddingResultItem] = []
                    for idx, it in enumerate(request.items):
                        vec = raw_embeddings[idx]
                        if request.normalization == NormalizationPolicy.L2:
                            vec = _l2_normalize(vec)
                        results.append(
                            EmbeddingResultItem(
                                item_id=it.item_id,
                                vector=vec,
                                dimension=len(vec),
                                content_hash=it.content_hash,
                            )
                        )
                    latency_ms = (time.perf_counter() - start_t) * 1000.0
                    return EmbeddingBatchResult(
                        results=results,
                        model_name=payload["model"],
                        model_version=self._model_version,
                        dimension=self._dimension,
                        normalization=request.normalization,
                        dtype=request.dtype,
                        total_tokens=total_tokens,
                        latency_ms=latency_ms,
                    )
                elif resp.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                    jitter = random.uniform(0.1, 0.3)
                    await asyncio.sleep(backoff + jitter)
                    backoff *= 2.0
                    continue
                else:
                    resp.raise_for_status()
            except httpx.HTTPError as err:
                if attempt >= retries:
                    logger.error("Cohere embedding failed after retries", error=str(err))
                    raise
                jitter = random.uniform(0.1, 0.3)
                await asyncio.sleep(backoff + jitter)
                backoff *= 2.0

        raise RuntimeError("Failed to generate Cohere embeddings after retries")

    async def embed_single(
        self,
        text: str,
        input_type: EmbeddingInputType = EmbeddingInputType.DOCUMENT,
    ) -> List[float]:
        req = EmbeddingBatchRequest(
            items=[
                EmbeddingRequestItem(
                    item_id="single",
                    text=text,
                    content_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                )
            ],
            input_type=input_type,
        )
        res = await self.embed_batch(req)
        return res.results[0].vector


# ============================================================================
# 3. OpenAI Provider
# ============================================================================


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI Embedding Provider (text-embedding-3-small / -large).

    - Model from EMBEDDING_MODEL_NAME when it is an OpenAI embedding model, else
      text-embedding-3-small.
    - Output size from EMBEDDING_DIMENSION via the API's ``dimensions`` parameter
      (Matryoshka truncation), so it matches the Qdrant collection (1024 by default).
    - Vectors requested as base64 float32 (~4 bytes/value instead of ~12 bytes of JSON
      text): about 3x less download per batch, which matters on slow links.
    - Retries 429 / 5xx / network errors with exponential backoff + jitter.
    - Splits requests to stay under the API's 2048-inputs-per-request limit.
    """

    MAX_INPUTS_PER_REQUEST = 1024
    # Measured on a ~2.7 Mbps link: imports are bandwidth-bound (each 1024-d vector is
    # ~5.5 KB of base64), so parallel sub-requests only competed with the database upload
    # (import 80 s -> 122 s). One request per batch is the fastest end to end.
    PARALLEL_CHUNK_SIZE = 1024  # inputs per HTTP request
    PARALLEL_REQUESTS = 1       # concurrent requests per batch

    def __init__(self, settings: Optional[EmbeddingSettings] = None):
        self._settings = settings or get_settings().embedding
        self._api_key = self._settings.openai_api_key or get_settings().llm.openai_api_key
        configured = (self._settings.model_name or "").strip()
        self._model_name = configured if configured.startswith("text-embedding-") else "text-embedding-3-small"
        self._dimension = int(self._settings.dimension or 1024)
        # Model + size in the version string keeps point ids / cache keys distinct per configuration.
        self._model_version = f"{self._model_name.replace('text-embedding-', '')}-{self._dimension}"
        self._endpoint = "https://api.openai.com/v1/embeddings"
        self._timeout = httpx.Timeout(max(60.0, float(self._settings.request_timeout_seconds)), connect=15.0)
        self._max_retries = max(0, int(self._settings.max_retries))
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def model_version(self) -> str:
        return self._model_version

    @property
    def dimension(self) -> int:
        return self._dimension

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            # Keep connections alive between requests (httpx default is 5s), so edits and
            # customer queries reuse a warm TLS connection instead of reconnecting.
            self._client = httpx.AsyncClient(
                timeout=self._timeout,
                limits=httpx.Limits(max_connections=24, max_keepalive_connections=12, keepalive_expiry=120.0),
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def warm_up(self) -> None:
        """Open the TLS connection ahead of the first real request (1-token request)."""
        await self.embed_single("warm up")

    @staticmethod
    def _decode(embedding: Any) -> List[float]:
        if isinstance(embedding, str):
            import base64
            import struct

            raw = base64.b64decode(embedding)
            return list(struct.unpack(f"<{len(raw) // 4}f", raw))
        return list(embedding)

    async def _post_with_retry(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self._api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured for OpenAI embeddings")
        client = await self._get_client()
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        last_err: Optional[BaseException] = None
        for attempt in range(self._max_retries + 1):
            attempt_t0 = time.perf_counter()
            try:
                resp = await client.post(self._endpoint, json=payload, headers=headers)
                if resp.status_code == 429 or resp.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        f"OpenAI embeddings HTTP {resp.status_code}", request=resp.request, response=resp
                    )
                resp.raise_for_status()
                return resp.json()
            except (httpx.TransportError, httpx.HTTPStatusError) as err:
                status = getattr(getattr(err, "response", None), "status_code", None)
                retryable = isinstance(err, httpx.TransportError) or status == 429 or (status or 0) >= 500
                last_err = err
                if not retryable or attempt >= self._max_retries:
                    break
                retry_after = 0.0
                if status == 429:
                    try:
                        retry_after = float(err.response.headers.get("retry-after", 0))  # type: ignore[union-attr]
                    except (TypeError, ValueError):
                        retry_after = 0.0
                delay = max(retry_after, (2 ** attempt) * 1.0 + random.uniform(0, 0.5))
                # httpx transport errors (ReadTimeout, RemoteProtocolError, ConnectError)
                # often have an empty message: always log the type and how long it took.
                logger.warning(
                    "OpenAI embeddings request failed; retrying",
                    attempt=attempt + 1,
                    status=status,
                    error_type=type(err).__name__,
                    attempt_seconds=round(time.perf_counter() - attempt_t0, 2),
                    inputs=len(payload.get("input") or []),
                    delay_seconds=round(delay, 2),
                    error=str(err)[:200] or repr(err)[:200],
                )
                await asyncio.sleep(delay)
        assert last_err is not None
        raise last_err

    async def embed_batch(self, request: EmbeddingBatchRequest) -> EmbeddingBatchResult:
        if not request.items:
            return EmbeddingBatchResult(
                results=[],
                model_name=self._model_name,
                model_version=self._model_version,
                dimension=self._dimension,
                normalization=request.normalization,
                dtype=request.dtype,
            )

        start_t = time.perf_counter()
        results: List[EmbeddingResultItem] = []
        total_tokens = 0
        items = list(request.items)
        # Requests are split only to respect the per-request input limit (see PARALLEL_* above).
        size = max(1, min(self.MAX_INPUTS_PER_REQUEST, self.PARALLEL_CHUNK_SIZE))
        parts = [items[i : i + size] for i in range(0, len(items), size)]
        sem = asyncio.Semaphore(self.PARALLEL_REQUESTS)

        async def _one(part):
            async with sem:
                return await self._post_with_retry({
                    "model": self._model_name,
                    "input": [it.text for it in part],
                    "dimensions": self._dimension,
                    "encoding_format": "base64",
                })

        responses = await asyncio.gather(*(_one(part) for part in parts))
        for part, data in zip(parts, responses):
            total_tokens += data.get("usage", {}).get("total_tokens", 0)
            raw_items = sorted(data.get("data", []), key=lambda d: d.get("index", 0))
            if len(raw_items) != len(part):
                raise RuntimeError(
                    f"OpenAI returned {len(raw_items)} embeddings for {len(part)} inputs"
                )
            for it, raw in zip(part, raw_items):
                vec = self._decode(raw["embedding"])
                if request.normalization == NormalizationPolicy.L2:
                    vec = _l2_normalize(vec)
                results.append(
                    EmbeddingResultItem(
                        item_id=it.item_id,
                        vector=vec,
                        dimension=len(vec),
                        content_hash=it.content_hash,
                        token_count=None,
                    )
                )

        latency_ms = (time.perf_counter() - start_t) * 1000.0
        return EmbeddingBatchResult(
            results=results,
            model_name=self._model_name,
            model_version=self._model_version,
            dimension=self._dimension,
            normalization=request.normalization,
            dtype=request.dtype,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
        )

    async def embed_single(
        self,
        text: str,
        input_type: EmbeddingInputType = EmbeddingInputType.DOCUMENT,
    ) -> List[float]:
        req = EmbeddingBatchRequest(
            items=[
                EmbeddingRequestItem(
                    item_id="single",
                    text=text,
                    content_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                )
            ],
            input_type=input_type,
        )
        res = await self.embed_batch(req)
        return res.results[0].vector


# ============================================================================
# 4. Local Deterministic Provider (Offline, Reproducible, High-Speed)
# ============================================================================


class LocalDeterministicEmbeddingProvider(EmbeddingProvider):
    """High-speed local deterministic embedding provider.

    Generates mathematically consistent 1024-dimensional unit vectors using
    n-gram word-hash trigonometric projections. Identical text produces identical
    vectors. Semantically similar texts (sharing tokens/subwords) share high cosine
    similarity, while dissimilar texts produce near-orthogonal vectors.

    Guarantees:
    - Zero external network dependency.
    - Zero API key requirement.
    - Guaranteed L2 unit normalization.
    - Deterministic across restarts.
    - Sub-millisecond latency for benchmarking and test execution.
    """

    def __init__(
        self,
        model_name: str = "proxipilot-local-v1",
        dimension: int = 1024,
    ):
        self._model_name = model_name
        self._model_version = "2026-v1"
        self._dimension = dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def model_version(self) -> str:
        return self._model_version

    @property
    def dimension(self) -> int:
        return self._dimension

    def _generate_vector(self, text: str) -> List[float]:
        """Compute deterministic dense vector from text tokens.

        Vectorised (NumPy) implementation of the original per-coordinate Python loop.
        The original did ~dimension trig operations per token in pure Python on the
        event loop (minutes of CPU for a 5k-row import). Each token's contribution is
        a fixed pattern derived only from its SHA-256 digest, so it is computed once
        per distinct token (LRU-cached), then combined with positional weights in a
        single matrix product. Output is numerically equivalent to the old loop
        (differences at float rounding level only).
        """
        tokens = text.lower().split()
        if not tokens:
            tokens = ["<empty>"]
        if _np is None or self._dimension % 4 != 0:
            return self._generate_vector_reference(tokens)

        patterns = _np.stack([self._token_pattern(tok) for tok in tokens])
        pos_weights = 1.0 / (1.0 + 0.05 * _np.arange(len(tokens), dtype=_np.float64))
        vec = pos_weights @ patterns
        return _l2_normalize(vec.tolist())

    def _token_pattern(self, tok: str):
        return _token_pattern_cached(tok, self._dimension)

    def _generate_vector_reference(self, tokens: List[str]) -> List[float]:
        """Original scalar algorithm (fallback when NumPy is unavailable)."""
        vec = [0.0] * self._dimension
        for i, tok in enumerate(tokens):
            h = hashlib.sha256(tok.encode("utf-8")).digest()
            for d in range(0, self._dimension, 4):
                idx = (d // 4) % len(h)
                weight = (h[idx] - 128) / 128.0
                pos_weight = 1.0 / (1.0 + 0.05 * i)
                vec[d % self._dimension] += weight * pos_weight
                vec[(d + 1) % self._dimension] += math.sin(weight * math.pi) * pos_weight
                vec[(d + 2) % self._dimension] += math.cos(weight * math.pi) * pos_weight
                vec[(d + 3) % self._dimension] += (weight * weight - 0.5) * pos_weight
        return _l2_normalize(vec)

    def _embed_batch_sync(self, request: EmbeddingBatchRequest) -> EmbeddingBatchResult:
        start_t = time.perf_counter()
        results: List[EmbeddingResultItem] = []

        for it in request.items:
            vec = self._generate_vector(it.text)
            if request.normalization == NormalizationPolicy.L2:
                vec = _l2_normalize(vec)
            results.append(
                EmbeddingResultItem(
                    item_id=it.item_id,
                    vector=vec,
                    dimension=self._dimension,
                    content_hash=it.content_hash,
                    token_count=len(it.text.split()),
                )
            )

        latency_ms = (time.perf_counter() - start_t) * 1000.0
        return EmbeddingBatchResult(
            results=results,
            model_name=self._model_name,
            model_version=self._model_version,
            dimension=self._dimension,
            normalization=request.normalization,
            dtype=request.dtype,
            total_tokens=sum(r.token_count or 0 for r in results),
            latency_ms=latency_ms,
        )

    async def embed_batch(self, request: EmbeddingBatchRequest) -> EmbeddingBatchResult:
        # CPU-bound: run off the event loop so API requests and heartbeats stay responsive.
        if len(request.items) <= 4:
            return self._embed_batch_sync(request)
        return await asyncio.to_thread(self._embed_batch_sync, request)

    async def embed_single(
        self,
        text: str,
        input_type: EmbeddingInputType = EmbeddingInputType.DOCUMENT,
    ) -> List[float]:
        vec = self._generate_vector(text)
        return _l2_normalize(vec)


# ============================================================================
# Provider Factory
# ============================================================================


_PROVIDER_CACHE: Dict[tuple, "EmbeddingProvider"] = {}


def get_embedding_provider(
    provider_name: Optional[str] = None,
    settings: Optional[EmbeddingSettings] = None,
) -> EmbeddingProvider:
    """Return the configured embedding provider, reusing one instance per configuration.

    Providers own pooled HTTP clients. Building a new provider per query (as the
    retrievers did) opened a fresh TLS connection to the embedding API on every
    customer query — seconds of latency on slow links. Explicit ``settings`` objects
    (tests, tooling) bypass the cache.
    """
    if settings is not None:
        return _build_embedding_provider(provider_name, settings)
    cfg = get_settings().embedding
    key = ((provider_name or cfg.provider or "local").lower(), cfg.model_name, cfg.dimension)
    provider = _PROVIDER_CACHE.get(key)
    if provider is None:
        provider = _build_embedding_provider(provider_name, cfg)
        _PROVIDER_CACHE[key] = provider
    return provider


def _build_embedding_provider(
    provider_name: Optional[str],
    settings: EmbeddingSettings,
) -> EmbeddingProvider:
    """Instantiate the appropriate configured embedding provider."""
    cfg = settings
    name = (provider_name or cfg.provider or "local").lower()

    if name == "voyage":
        if not cfg.voyage_api_key:
            logger.warning("Voyage API key not set; falling back to local deterministic provider")
            return LocalDeterministicEmbeddingProvider()
        return VoyageEmbeddingProvider(settings=cfg)
    elif name == "cohere":
        if not cfg.cohere_api_key:
            logger.warning("Cohere API key not set; falling back to local deterministic provider")
            return LocalDeterministicEmbeddingProvider()
        return CohereEmbeddingProvider(settings=cfg)
    elif name == "openai":
        return OpenAIEmbeddingProvider(settings=cfg)
    elif name in ("local", "deterministic", "mock"):
        # Always report the local model's own name. EMBEDDING_MODEL_NAME describes the
        # remote model (default "voyage-4-large"); stamping that on hash-based vectors
        # mislabelled every Qdrant point and hid provider mismatches.
        return LocalDeterministicEmbeddingProvider(
            model_name="proxipilot-local-v1",
            dimension=cfg.dimension or 1024,
        )
    else:
        logger.warning(f"Unknown embedding provider '{name}'; defaulting to local")
        return LocalDeterministicEmbeddingProvider()
