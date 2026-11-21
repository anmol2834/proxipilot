/**
 * Knowledge Service — ProxiPilot Enterprise Knowledge API
 *
 * Connects to the real backend knowledge endpoints.
 * Handles multipart file upload, import job polling, CRUD operations.
 *
 * API contracts:
 *   GET    /knowledge                          → KnowledgeCursorPageDTO
 *   POST   /knowledge                          → KnowledgeItemResponseDTO
 *   GET    /knowledge/{id}                     → KnowledgeItemResponseDTO
 *   PATCH  /knowledge/{id}                     → KnowledgeItemResponseDTO
 *   DELETE /knowledge/{id}                     → { status }
 *   POST   /knowledge/imports/upload           → FileUploadResponseDTO  (multipart)
 *   GET    /knowledge/imports/{job_id}         → ImportJobResponseDTO
 */

import { apiClient } from "@/lib/api/client";
import type { CompanyInfoSaveRequest, CompanyInfoState } from "@/types/company-info.types";
import { env } from "@/config/env";
import {
  KnowledgeItem,
  KnowledgeCategory,
  KnowledgeStatus,
  KnowledgeSource,
  KnowledgeItemType,
} from "@/types/knowledge.types";

// =============================================================================
// Backend DTO Types
// =============================================================================

export interface BackendKnowledgeVersion {
  id: string;
  version_number: number;
  lifecycle_status: string;
  content: string | null;
  canonical_data: Record<string, unknown> | null;
  projection_status: string | null;
  semantic_status: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

export interface BackendKnowledgeItem {
  id: string;
  organizationId?: string;
  tenant_id?: string;
  source_id?: string | null;
  category: string;
  type?: string;
  title: string;
  excerpt?: string;
  description?: string | null;
  content?: string | null;
  status: string;
  source?: string;
  source_type?: string;
  version?: number;
  current_version?: number;
  active_version?: BackendKnowledgeVersion | null;
  updatedAt?: string;
  updated_at?: string;
  created_at?: string;
  updatedBy?: string;
  created_by_user_id?: string | null;
  tags?: string[];
  canonical_data?: Record<string, unknown>;
  custom_attributes?: Record<string, unknown>;
  facts?: Record<string, unknown>;
  pricing?: string | null;
  currency?: string | null;
  warranty?: string | null;
  serviceRegions?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  conditions?: string | null;
  question?: string | null;
  answer?: string | null;
  discount?: string | null;
  code?: string | null;
  city?: string | null;
}

export interface BackendKnowledgeListResponse {
  items: BackendKnowledgeItem[];
  next_cursor: string | null;
  has_more: boolean;
  total?: number;
  total_count?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

export interface FileUploadResponseDTO {
  upload_id: string;
  source_id: string;
  job_id: string;
  dataset_name: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  checksum: string;
  checksum_algorithm: string;
  status: string;
  is_duplicate: boolean;
  created_at: string;
}

export interface ImportJobResponseDTO {
  id: string;
  organization_id: string;
  source_id: string;
  dataset_name: string;
  file_type: string;
  file_size_bytes: number | null;
  file_uri: string | null;
  status: string;
  current_stage: string;
  row_count: number | null;
  processed_rows: number;
  failed_rows: number;
  progress_percent: number;
  worker_id: string | null;
  last_heartbeat_at: string | null;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  completed_at: string | null;
  cancel_requested_at: string | null;
  created_at: string;
  updated_at: string;
  error_summary: string | null;
  error_details: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_by_user_id: string | null;
}

export interface KnowledgeListParams {
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
  page?: number;
  cursor?: string;
  sort?: string;
}

// =============================================================================
// Mapping helpers
// =============================================================================

/** Map backend category key → frontend KnowledgeCategory */
function mapCategory(raw?: string | null): KnowledgeCategory {
  if (!raw) return "company-info";
  const normalized = String(raw).toLowerCase().replace(/_/g, "-");
  const MAP: Record<string, KnowledgeCategory> = {
    "products-services": "products-services",
    "company-info": "company-info",
    policies: "policies",
    "support-faqs": "support-faqs",
    "offers-promotions": "offers-promotions",
    "processes-timelines": "processes-timelines",
  };
  return MAP[normalized] ?? "company-info";
}

/** Map backend lifecycle_status → frontend KnowledgeStatus */
function mapStatus(raw?: string | null): KnowledgeStatus {
  if (!raw) return "Draft";
  const lower = String(raw).toLowerCase();
  const MAP: Record<string, KnowledgeStatus> = {
    active: "Published",
    published: "Published",
    draft: "Draft",
    archived: "Archived",
    processing: "Processing",
    needs_review: "Needs review",
    "needs review": "Needs review",
  };
  return MAP[lower] ?? (raw as KnowledgeStatus) ?? "Draft";
}

/** Map backend source_type → frontend KnowledgeSource */
function mapSource(raw?: string | null): KnowledgeSource {
  if (!raw) return "Manual";
  const lower = String(raw).toLowerCase();
  const MAP: Record<string, KnowledgeSource> = {
    manual: "Manual",
    website: "Website",
    document: "Document",
    imported: "Imported",
    integration: "Integration",
    file_upload: "Imported",
    upload: "Imported",
  };
  return MAP[lower] ?? (raw as KnowledgeSource) ?? "Manual";
}

/** Derive a human-readable item type from category or raw type */
function mapType(rawType?: string | null, category?: KnowledgeCategory): KnowledgeItemType {
  const validTypes: KnowledgeItemType[] = [
    "Service",
    "Policy",
    "Offer",
    "Information",
    "FAQ",
    "Process",
  ];
  if (rawType && validTypes.includes(rawType as KnowledgeItemType)) {
    return rawType as KnowledgeItemType;
  }
  const cat = category ?? "company-info";
  const MAP: Record<KnowledgeCategory, KnowledgeItemType> = {
    "products-services": "Service",
    "company-info": "Information",
    policies: "Policy",
    "support-faqs": "FAQ",
    "offers-promotions": "Offer",
    "processes-timelines": "Process",
  };
  return MAP[cat] ?? "Information";
}

/** Format ISO timestamp → "Sep 12, 2024" */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  if (!iso.includes("T") && !iso.includes("-")) {
    return iso;
  }
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

/** Map a single backend knowledge item → frontend KnowledgeItem */
export function mapBackendItem(raw: BackendKnowledgeItem): KnowledgeItem {
  if (!raw) return {} as KnowledgeItem;

  const category = mapCategory(raw.category);
  const type = mapType(raw.type, category);
  const activeVersion = raw.active_version;
  const facts = raw.canonical_data ?? raw.facts ?? activeVersion?.canonical_data ?? {};
  const status = mapStatus(raw.status ?? activeVersion?.lifecycle_status ?? "draft");
  const rawSource = raw.source ?? raw.source_type ?? "Manual";
  const source = mapSource(rawSource);

  const rawDate = raw.updatedAt ?? raw.updated_at ?? raw.created_at;
  const updatedAt = typeof rawDate === "string" ? formatDate(rawDate) : "—";
  const updatedBy = raw.updatedBy ?? (raw.created_by_user_id ? "Team" : "You");

  const excerpt =
    raw.excerpt ??
    raw.description ??
    (typeof facts.description === "string" ? facts.description : "") ??
    "";

  const base: Record<string, unknown> = {
    id: raw.id ?? "",
    organizationId: raw.organizationId ?? raw.tenant_id ?? "",
    category,
    type,
    title: raw.title ?? "Untitled",
    excerpt,
    status,
    source,
    version: raw.version ?? raw.current_version ?? 1,
    updatedAt,
    updatedBy,
    content: raw.content ?? (typeof facts.content === "string" ? facts.content : undefined),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    ...(typeof facts === "object" && facts !== null ? facts : {}),
    commercialPriceType:
      (facts as Record<string, unknown>)?.commercial_price_type ??
      (facts as Record<string, unknown>)?.commercialPriceType ??
      "not_specified",
    ...(raw.pricing ? { pricing: raw.pricing } : {}),
    ...(raw.currency ? { currency: raw.currency } : {}),
    ...(raw.warranty ? { warranty: raw.warranty } : {}),
    ...(raw.serviceRegions ? { serviceRegions: raw.serviceRegions } : {}),
    ...(raw.email ? { email: raw.email } : {}),
    ...(raw.phone ? { phone: raw.phone } : {}),
    ...(raw.role ? { role: raw.role } : {}),
    ...(raw.conditions ? { conditions: raw.conditions } : {}),
    ...(raw.question ? { question: raw.question } : {}),
    ...(raw.answer ? { answer: raw.answer } : {}),
    ...(raw.discount ? { discount: raw.discount } : {}),
    ...(raw.code ? { code: raw.code } : {}),
    ...(raw.city ? { city: raw.city } : {}),
  };

  return base as unknown as KnowledgeItem;
}

// =============================================================================
// Knowledge Service
// =============================================================================

class KnowledgeService {
  private readonly base = "/knowledge";

  /**
   * List knowledge items in batches with optional filters + keyset/offset pagination.
   */
  async listItems(params: KnowledgeListParams = {}): Promise<{
    items: KnowledgeItem[];
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const limit = params.limit ?? 10;
    const res = await apiClient.get<BackendKnowledgeListResponse>(this.base, {
      params: {
        ...(params.category ? { category: params.category } : {}),
        ...(params.status && params.status !== "All" ? { status: params.status.toLowerCase() } : {}),
        ...(params.search ? { search: params.search } : {}),
        limit,
        ...(params.page ? { page: params.page } : {}),
        ...(params.cursor ? { cursor: params.cursor } : {}),
        sort: params.sort ?? "updated-desc",
      },
    });

    const data = res.data;
    const items = (data?.items ?? []).map(mapBackendItem);
    const total = data?.total_count ?? data?.total ?? items.length;
    const totalPages = data?.total_pages ?? Math.max(1, Math.ceil(total / limit));
    return {
      items,
      nextCursor: data?.next_cursor ?? null,
      hasMore: data?.has_more ?? false,
      total,
      page: data?.page ?? params.page ?? 1,
      totalPages,
    };
  }

  /**
   * Fetch aggregate item counts per category for the tenant dashboard.
   */
  /**
   * Real per-category item counts. Errors propagate so callers never mistake a
   * failed request for "every category is empty".
   */
  /** Company Info editor state (shared facts with owner + share flag, Company-Info facts, index state). */
  async getCompanyInfo(): Promise<CompanyInfoState> {
    return (await apiClient.get<CompanyInfoState>(`${this.base}/company-info`)).data;
  }

  /** Partial, revision-checked save. 409 = someone else saved first (re-fetch and reapply). */
  async saveCompanyInfo(body: CompanyInfoSaveRequest): Promise<CompanyInfoState> {
    return (await apiClient.put<CompanyInfoState>(`${this.base}/company-info`, body)).data;
  }

  async getCategoryCounts(): Promise<Record<string, number>> {
    const res = await apiClient.get<Record<string, number>>(`${this.base}/stats`);
    return res.data ?? {};
  }

  /**
   * Upload a file and kick off an import job.
   * Returns the FileUploadResponseDTO which includes job_id.
   *
   * Uses multipart/form-data — must NOT set Content-Type manually.
   */
  async uploadFile(
    file: File,
    datasetName: string,
    category?: string,
    onProgress?: (pct: number) => void
  ): Promise<FileUploadResponseDTO> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("dataset_name", datasetName);
    if (category) {
      formData.append("category", category);
    }

    // Use XMLHttpRequest for real progress tracking
    return new Promise<FileUploadResponseDTO>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      // Same base URL as every other API call (NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_API_URL).
      const baseUrl = env.API_BASE_URL;
      const url = `${baseUrl.replace(/\/+$/, "")}/knowledge/imports/upload`;

      xhr.open("POST", url, true);
      xhr.withCredentials = true;

      // Progress
      if (onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            onProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as FileUploadResponseDTO);
          } catch {
            reject(new Error("Invalid JSON in upload response"));
          }
        } else {
          let msg = `Upload failed (${xhr.status})`;
          try {
            const parsed = JSON.parse(xhr.responseText);
            msg = parsed?.detail ?? parsed?.message ?? msg;
          } catch {
            /* ignore */
          }
          reject(new Error(msg));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload request timed out"));

      xhr.send(formData);
    });
  }

  /** Fetch an import job's current status once. */
  async getImportJob(jobId: string): Promise<ImportJobResponseDTO> {
    const res = await apiClient.get<ImportJobResponseDTO>(`/knowledge/imports/${jobId}`);
    return res.data;
  }

  /**
   * Poll an import job until terminal state with adaptive fast intervals.
   * Resolves with final job DTO on completion, rejects on failure or timeout.
   */
  async pollImportJob(
    jobId: string,
    onProgress?: (job: ImportJobResponseDTO) => void,
    initialIntervalMs = 500,
    maxDurationMs = 30 * 60 * 1000
  ): Promise<ImportJobResponseDTO> {
    // Exactly one request in flight at a time (the next poll is scheduled only after
    // the previous response arrives), with backoff to 3s. The deadline is time-based:
    // the old 120-attempt cap gave up after ~3 minutes even while a large import was
    // still progressing normally on the server.
    const TERMINAL = new Set(["completed", "partial", "failed", "cancelled"]);
    const MAX_INTERVAL_MS = 3000;
    const MAX_CONSECUTIVE_ERRORS = 5;
    const deadline = Date.now() + maxDurationMs;
    let currentInterval = initialIntervalMs;
    let consecutiveErrors = 0;

    await new Promise((r) => setTimeout(r, 200));

    while (Date.now() < deadline) {
      let job: ImportJobResponseDTO | null = null;
      try {
        const res = await apiClient.get<ImportJobResponseDTO>(
          `/knowledge/imports/${jobId}`
        );
        job = res.data;
        consecutiveErrors = 0;
      } catch (err) {
        // Transient fetch errors (network blip, server restart) are retried with backoff.
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) throw err;
      }

      if (job) {
        if (onProgress) onProgress(job);
        if (TERMINAL.has(job.status)) {
          if (job.status === "completed" || job.status === "partial") return job;
          throw new Error(
            job.error_summary ?? `Import job ${job.status}: ${job.current_stage}`
          );
        }
      }

      await new Promise((r) => setTimeout(r, currentInterval));
      currentInterval = Math.min(MAX_INTERVAL_MS, Math.round(currentInterval * 1.4));
    }

    throw new Error("Import is still running in the background. Refresh later to see the results.");
  }

  /**
   * Delete a knowledge item (soft archive by default).
   */
  async deleteItem(id: string): Promise<void> {
    await apiClient.delete(`${this.base}/${id}`);
  }

  /**
   * Update a knowledge item's status.
   */
  async updateItemStatus(id: string, status: KnowledgeStatus): Promise<KnowledgeItem> {
    const backendStatus = status === "Published" ? "active" : status.toLowerCase();
    const res = await apiClient.patch<BackendKnowledgeItem>(`${this.base}/${id}`, {
      status: backendStatus,
    });
    return mapBackendItem(res.data);
  }

  /**
   * Duplicate a knowledge item (create copy with Draft status).
   */
  async duplicateItem(source: KnowledgeItem): Promise<KnowledgeItem> {
    const { title, category, excerpt, content, tags } = source;
    const res = await apiClient.post<BackendKnowledgeItem>(this.base, {
      title: `${title} (Copy)`,
      category: category.replace(/-/g, "_"),
      description: excerpt,
      content,
      tags,
      source_type: "manual",
      facts: {},
    });
    return mapBackendItem(res.data);
  }
}

export const knowledgeService = new KnowledgeService();
