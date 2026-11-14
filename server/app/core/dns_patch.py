"""Proactive DNS Resolver Patch for Windows / Restricted Environments.

Solves:
1. Windows ISP DNS servers returning RCODE_REFUSED or taking 15+ seconds to resolve
   cloud hostnames like *.neon.tech and *.upstash.io.
2. Windows NAT64 prefix (64:ff9b::...) IPv6 timeouts by prioritizing IPv4 (AF_INET).
3. Thread-safe in-memory caching of resolved IPv4 addresses with TTL to eliminate
   repeated DNS query roundtrips.
"""

import socket
import time
from typing import Dict, List, Tuple
from app.core.logging import logger

_orig_getaddrinfo = socket.getaddrinfo
_DNS_CACHE: Dict[str, Tuple[float, List[str]]] = {}
_CACHE_TTL = 300.0  # 5 minutes for live DNS answers
# Static fallback IPs are cached much longer: re-trying broken resolvers every 5 min
# added ~2s (public DNS timeout) + ~8s (OS DNS failure) to new DB connections.
_FALLBACK_CACHE_TTL = 3600.0
# After the public resolvers fail, skip them for this long instead of timing out again.
_PUBLIC_DNS_BACKOFF = 600.0
_public_dns_down_until = 0.0

# Public recursive DNS resolvers (Google & Cloudflare)
_PUBLIC_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"]

# Hostnames known to fail or hang on Windows ISP DNS
_FAST_RESOLVE_DOMAINS = ("neon.tech", "upstash.io", "googleapis.com")

# External API hosts whose last successful OS resolution is remembered and reused when
# the OS resolver intermittently fails (observed: "[Errno 11001] getaddrinfo failed").
_CACHED_OS_DOMAINS = ("openai.com", "voyageai.com", "cohere.com", "cohere.ai", "googleapis.com")
_LAST_GOOD_OS_IPS: Dict[str, List[str]] = {}

_resolver = None
try:
    import dns.resolver
    _resolver = dns.resolver.Resolver(configure=False)
    _resolver.nameservers = _PUBLIC_DNS_SERVERS
    _resolver.timeout = 1.5
    _resolver.lifetime = 2.0
except Exception:
    _resolver = None


def resolve_ipv4_addresses(host_str: str) -> List[str]:
    """Resolve IPv4 'A' records for a host using caching and public recursive DNS."""
    now = time.time()
    if host_str in _DNS_CACHE:
        cached_time, ips = _DNS_CACHE[host_str]
        if now - cached_time < _CACHE_TTL:
            return ips

    global _public_dns_down_until
    if (
        _resolver
        and now >= _public_dns_down_until
        and any(domain in host_str for domain in _FAST_RESOLVE_DOMAINS)
    ):
        try:
            answers = _resolver.resolve(host_str, "A")
            ips = [rdata.address for rdata in answers]
            if ips:
                _DNS_CACHE[host_str] = (now, ips)
                return ips
        except Exception as e:
            _public_dns_down_until = now + _PUBLIC_DNS_BACKOFF
            logger.debug("Public DNS resolution failed, falling back to OS", host=host_str, error=str(e))

    # Known fallback IP mappings for Singapore Neon and Upstash if DNS completely fails
    if "neon.tech" in host_str:
        fallback_ips = ["52.76.108.241", "13.251.213.89", "52.76.128.157"]
        # Back-dated timestamp so the long fallback TTL applies to this entry.
        _DNS_CACHE[host_str] = (now - _CACHE_TTL + _FALLBACK_CACHE_TTL, fallback_ips)
        return fallback_ips

    return []


def resilient_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    """Intercept socket.getaddrinfo to resolve cloud hosts immediately without 15s Windows DNS timeouts."""
    host_str = str(host) if host else ""

    # Fast path for cloud domains that hang on Windows
    if host_str and any(domain in host_str for domain in _FAST_RESOLVE_DOMAINS):
        ips = resolve_ipv4_addresses(host_str)
        if ips:
            return [(socket.AF_INET, socket.SOCK_STREAM, proto or 6, "", (ip, port)) for ip in ips]

    # Standard path: call original and sort IPv4 ahead of IPv6
    is_cloud = bool(host_str) and any(domain in host_str for domain in _CACHED_OS_DOMAINS)
    try:
        results = _orig_getaddrinfo(host, port, family, type, proto, flags)
        if is_cloud:
            ips = [r[4][0] for r in results if r[0] == socket.AF_INET]
            if ips:
                _LAST_GOOD_OS_IPS[host_str] = ips
        return sorted(results, key=lambda x: 0 if x[0] == socket.AF_INET else 1)
    except socket.gaierror as e:
        # Emergency fallback for neon.tech if gaierror was raised
        if "neon.tech" in host_str:
            fallback_ips = ["52.76.108.241", "13.251.213.89", "52.76.128.157"]
            return [(socket.AF_INET, socket.SOCK_STREAM, proto or 6, "", (ip, port)) for ip in fallback_ips]
        # Intermittent OS DNS failures: reuse the last address that resolved for this
        # host (e.g. api.openai.com) instead of failing the request outright.
        stale = _LAST_GOOD_OS_IPS.get(host_str)
        if stale:
            logger.debug("OS DNS failed; using last known addresses", host=host_str)
            return [(socket.AF_INET, socket.SOCK_STREAM, proto or 6, "", (ip, port)) for ip in stale]
        raise


def apply_dns_patch() -> None:
    """Apply the resilient getaddrinfo patch globally."""
    if socket.getaddrinfo is not resilient_getaddrinfo:
        socket.getaddrinfo = resilient_getaddrinfo
        logger.info("Resilient IPv4 DNS patch applied.")


# Apply patch immediately upon module import
apply_dns_patch()

