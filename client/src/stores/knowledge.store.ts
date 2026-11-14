"use client";

import { create } from "zustand";
import {
  KnowledgeItem,
  KnowledgeCategory,
  KnowledgeStatus,
  KnowledgeSortOption,
} from "@/types/knowledge.types";
import { knowledgeService } from "@/services/knowledge.service";
import { toast } from "@/stores/notification.store";

// =============================================================================
// Category meta (counts driven by real items)
// =============================================================================

export interface KnowledgeCategoryMeta {
  id: KnowledgeCategory;
  name: string;
  count: number;
  subtitle: string;
  iconType: string;
  color: string;
}

// =============================================================================
// Upload State Machine
// =============================================================================

export type UploadPhase =
  | "idle"
  | "uploading"    // XHR upload in progress
  | "processing"   // backend import job running
  | "done"         // completed successfully
  | "error";       // failed

export interface UploadState {
  phase: UploadPhase;
  uploadProgress: number;      // 0-100 during 'uploading'
  processingProgress: number;  // 0-100 during 'processing'
  jobId: string | null;
  currentStage: string | null;
  rowCount: number | null;
  processedRows: number;
  errorMessage: string | null;
  // Context of the running import, so it can be shown / resumed outside the dialog
  datasetName: string | null;
  category: string | null;
  fileName: string | null;
}

const INITIAL_UPLOAD_STATE: UploadState = {
  phase: "idle",
  uploadProgress: 0,
  processingProgress: 0,
  jobId: null,
  currentStage: null,
  rowCount: null,
  processedRows: 0,
  errorMessage: null,
  datasetName: null,
  category: null,
  fileName: null,
};

/** True while an upload or server-side import job is in flight. */
export const isUploadBusy = (u: UploadState): boolean =>
  u.phase === "uploading" || u.phase === "processing";

// -----------------------------------------------------------------------------
// Active-import persistence (survives page reloads / navigation)
// -----------------------------------------------------------------------------

const ACTIVE_IMPORT_STORAGE_KEY = "proxipilot_active_knowledge_import";

interface PersistedImport {
  jobId: string;
  datasetName: string | null;
  category: string | null;
  fileName: string | null;
}

function saveActiveImport(value: PersistedImport | null): void {
  try {
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(ACTIVE_IMPORT_STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(ACTIVE_IMPORT_STORAGE_KEY);
  } catch {
    /* storage unavailable — background tracking still works for this page session */
  }
}

function loadActiveImport(): PersistedImport | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(ACTIVE_IMPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedImport;
    return parsed && typeof parsed.jobId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

// =============================================================================
// Store Interface
// =============================================================================

interface KnowledgeState {
  // ── Server State ─────────────────────────────────────────────────────────
  items: KnowledgeItem[];
  isLoading: boolean;     // initial load
  isFetching: boolean;    // background refresh
  fetchError: string | null;
  totalCount: number;
  totalPages: number;
  nextCursor: string | null;
  hasMore: boolean;
  categoryCounts: Record<string, number>;
  /** True once real counts have been loaded from the server. */
  categoryCountsLoaded: boolean;

  // ── UI Filters / Pagination ───────────────────────────────────────────────
  selectedCategory: KnowledgeCategory;
  searchQuery: string;
  statusFilter: KnowledgeStatus | "All";
  sortOption: KnowledgeSortOption;
  currentPage: number;
  pageSize: number;
  selectedIds: string[];
  bannerDismissed: boolean;

  // ── Dialog State ──────────────────────────────────────────────────────────
  isAddDialogOpen: boolean;
  selectedCategoryForAdd: KnowledgeCategory | null;
  editingItem: KnowledgeItem | null;
  deletingItem: KnowledgeItem | null;

  // ── Upload State ──────────────────────────────────────────────────────────
  upload: UploadState;

  // ── Optimistic Deleting ───────────────────────────────────────────────────
  deletingIds: Set<string>;

  // ── UI Actions ────────────────────────────────────────────────────────────
  setSelectedCategory: (cat: KnowledgeCategory) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: KnowledgeStatus | "All") => void;
  setSortOption: (sort: KnowledgeSortOption) => void;
  setCurrentPage: (page: number) => void;
  toggleSelectId: (id: string) => void;
  selectAllOnPage: (ids: string[]) => void;
  clearSelection: () => void;
  dismissBanner: () => void;

  openAddDialog: (preselectedCat?: KnowledgeCategory) => void;
  closeAddDialog: () => void;
  openEditDialog: (item: KnowledgeItem) => void;
  closeEditDialog: () => void;
  openDeleteDialog: (item: KnowledgeItem) => void;
  closeDeleteDialog: () => void;

  /** Clears upload state. No-op while an import is in flight (it keeps running in background). */
  resetUpload: () => void;
  setUploadProgress: (pct: number) => void;

  /** Resume tracking an import that was running before a page reload. */
  resumeActiveImport: () => Promise<void>;

  // ── Async Server Actions ──────────────────────────────────────────────────
  /** Fetch/refresh knowledge items in batches from the server */
  fetchItems: (reset?: boolean, targetPage?: number) => Promise<void>;

  /** Fetch live category item counts for dashboard cards */
  fetchCategoryCounts: () => Promise<void>;

  /**
   * Two-phase enterprise upload:
   *   Phase 1 — XHR multipart upload → FileUploadResponseDTO (with job_id)
   *   Phase 2 — Poll import job until terminal state
   *   On success — refresh items list and close dialog
   */
  uploadAndImport: (
    file: File,
    datasetName: string,
    category: string
  ) => Promise<void>;

  /** Delete a single item (optimistic) */
  deleteItem: (id: string) => Promise<void>;

  /** Bulk delete (optimistic) */
  bulkDeleteItems: (ids: string[]) => Promise<void>;

  /** Bulk update status */
  bulkUpdateStatus: (ids: string[], status: KnowledgeStatus) => Promise<void>;

  /** Duplicate an item */
  duplicateKnowledgeItem: (id: string) => Promise<void>;

  /** Local-optimistic update for field-level edits (EditDialog) */
  updateKnowledgeItem: (id: string, updates: Partial<KnowledgeItem>) => void;
}

// =============================================================================
// Store
// =============================================================================

export const useKnowledgeStore = create<KnowledgeState>()((set, get) => ({
  // ── Initial State ─────────────────────────────────────────────────────────
  items: [],
  isLoading: false,
  isFetching: false,
  fetchError: null,
  totalCount: 0,
  totalPages: 1,
  nextCursor: null,
  hasMore: false,
  categoryCounts: {},
  categoryCountsLoaded: false,

  selectedCategory: "all",
  searchQuery: "",
  statusFilter: "All",
  sortOption: "updated-desc",
  currentPage: 1,
  pageSize: 10,
  selectedIds: [],
  bannerDismissed: false,

  isAddDialogOpen: false,
  selectedCategoryForAdd: null,
  editingItem: null,
  deletingItem: null,

  upload: INITIAL_UPLOAD_STATE,
  deletingIds: new Set(),

  // ── UI Actions ────────────────────────────────────────────────────────────
  setSelectedCategory: (cat) => {
    set({ selectedCategory: cat, currentPage: 1, selectedIds: [] });
    get().fetchItems(true, 1);
  },
  setSearchQuery: (query) => {
    set({ searchQuery: query, currentPage: 1 });
    get().fetchItems(true, 1);
  },
  setStatusFilter: (status) => {
    set({ statusFilter: status, currentPage: 1, selectedIds: [] });
    get().fetchItems(true, 1);
  },
  setSortOption: (sort) => {
    set({ sortOption: sort, currentPage: 1 });
    get().fetchItems(true, 1);
  },
  setCurrentPage: (page) => {
    set({ currentPage: page, selectedIds: [], isFetching: true });
    get().fetchItems(false, page);
  },
  toggleSelectId: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id],
    })),
  selectAllOnPage: (ids) =>
    set((state) => {
      const allSelected = ids.every((id) => state.selectedIds.includes(id));
      return {
        selectedIds: allSelected
          ? state.selectedIds.filter((id) => !ids.includes(id))
          : Array.from(new Set([...state.selectedIds, ...ids])),
      };
    }),
  clearSelection: () => set({ selectedIds: [] }),
  dismissBanner: () => set({ bannerDismissed: true }),

  openAddDialog: (preselectedCat) =>
    set({ isAddDialogOpen: true, selectedCategoryForAdd: preselectedCat ?? null }),
  // Closing the dialog never cancels an import: an in-flight job keeps running and
  // is tracked in the background (see BackgroundImportIndicator).
  closeAddDialog: () =>
    set((state) => ({
      isAddDialogOpen: false,
      selectedCategoryForAdd: null,
      upload: isUploadBusy(state.upload) ? state.upload : INITIAL_UPLOAD_STATE,
    })),
  openEditDialog: (item) => set({ editingItem: item }),
  closeEditDialog: () => set({ editingItem: null }),
  openDeleteDialog: (item) => set({ deletingItem: item }),
  closeDeleteDialog: () => set({ deletingItem: null }),

  resetUpload: () =>
    set((state) => (isUploadBusy(state.upload) ? {} : { upload: INITIAL_UPLOAD_STATE })),
  setUploadProgress: (pct) =>
    set((state) => ({
      upload: { ...state.upload, uploadProgress: pct },
    })),

  // ── Async Actions ─────────────────────────────────────────────────────────

  fetchItems: async (reset = false, targetPage?: number) => {
    const state = get();

    // Prevent duplicate fetch
    if (state.isLoading) return;

    const pageToFetch = targetPage ?? (reset ? 1 : state.currentPage);
    const isInitial = reset || state.items.length === 0;
    set({
      isLoading: isInitial,
      isFetching: true,
      fetchError: null,
      currentPage: pageToFetch,
    });

    try {
      const result = await knowledgeService.listItems({
        category: state.selectedCategory !== "all" ? state.selectedCategory : undefined,
        status: state.statusFilter !== "All" ? state.statusFilter : undefined,
        search: state.searchQuery.trim() || undefined,
        sort: state.sortOption,
        page: pageToFetch,
        limit: state.pageSize, // batch size = 10
      });

      set({
        items: result.items,
        totalCount: result.total,
        totalPages: result.totalPages,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        isLoading: false,
        isFetching: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load knowledge items";
      set({ fetchError: msg, isLoading: false, isFetching: false });
    }
  },

  fetchCategoryCounts: async () => {
    try {
      const counts = await knowledgeService.getCategoryCounts();
      set({ categoryCounts: counts, categoryCountsLoaded: true });
    } catch {
      /* ignore */
    }
  },

  uploadAndImport: async (file, datasetName, category) => {
    if (isUploadBusy(get().upload)) {
      throw new Error("Another import is already running. Please wait for it to finish.");
    }
    // Phase 1: Upload
    set({
      upload: {
        ...INITIAL_UPLOAD_STATE,
        phase: "uploading",
        uploadProgress: 0,
        datasetName,
        category,
        fileName: file.name,
      },
    });

    let jobId: string;
    try {
      const uploadResp = await knowledgeService.uploadFile(
        file,
        datasetName,
        category,
        (pct) => {
          set((state) => ({
            upload: { ...state.upload, uploadProgress: pct },
          }));
        }
      );
      jobId = uploadResp.job_id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      set((state) => ({ upload: { ...state.upload, phase: "error", errorMessage: msg } }));
      if (!get().isAddDialogOpen) {
        toast.error(msg, `Upload of "${datasetName}" failed`);
        set({ upload: INITIAL_UPLOAD_STATE });
      }
      throw new Error(msg);
    }

    // Phase 2: track the server-side job (continues even if the dialog is closed)
    await trackImportJob(jobId, { datasetName, category, fileName: file.name });
  },

  resumeActiveImport: async () => {
    const persisted = loadActiveImport();
    if (!persisted || isUploadBusy(get().upload)) return;
    // Check once first: a job that already finished, or belongs to another account /
    // organization, is cleared silently instead of surfacing a polling error.
    try {
      const job = await knowledgeService.getImportJob(persisted.jobId);
      if (["completed", "partial", "failed", "cancelled"].includes(job.status)) {
        saveActiveImport(null);
        return;
      }
    } catch {
      saveActiveImport(null);
      return;
    }
    try {
      await trackImportJob(persisted.jobId, persisted);
    } catch {
      /* outcome already surfaced via toast / dialog state */
    }
  },

  deleteItem: async (id) => {
    // Optimistic: remove from UI immediately
    const prev = get().items;
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      selectedIds: state.selectedIds.filter((x) => x !== id),
      deletingItem: null,
      deletingIds: new Set([...state.deletingIds, id]),
    }));

    try {
      await knowledgeService.deleteItem(id);
      set((state) => {
        const next = new Set(state.deletingIds);
        next.delete(id);
        return { deletingIds: next };
      });
      get().fetchItems(false, get().currentPage);
      get().fetchCategoryCounts();
    } catch {
      // Revert on failure
      set((state) => {
        const next = new Set(state.deletingIds);
        next.delete(id);
        return { items: prev, deletingIds: next };
      });
    }
  },

  bulkDeleteItems: async (ids) => {
    const prev = get().items;
    set((state) => ({
      items: state.items.filter((i) => !ids.includes(i.id)),
      selectedIds: [],
    }));

    try {
      await Promise.all(ids.map((id) => knowledgeService.deleteItem(id)));
      get().fetchItems(true, 1);
      get().fetchCategoryCounts();
    } catch {
      set({ items: prev });
    }
  },

  bulkUpdateStatus: async (ids, status) => {
    const prev = get().items;
    // Optimistic update
    set((state) => ({
      items: state.items.map((i) =>
        ids.includes(i.id)
          ? ({ ...i, status, updatedAt: "Just now" } as KnowledgeItem)
          : i
      ),
      selectedIds: [],
    }));

    try {
      await Promise.all(ids.map((id) => knowledgeService.updateItemStatus(id, status)));
      get().fetchItems(false, get().currentPage);
    } catch {
      set({ items: prev });
    }
  },

  duplicateKnowledgeItem: async (id) => {
    const source = get().items.find((i) => i.id === id);
    if (!source) return;

    try {
      await knowledgeService.duplicateItem(source);
      get().fetchItems(false, get().currentPage);
      get().fetchCategoryCounts();
    } catch {
      // Silently fail on duplicate error — user can retry
    }
  },

  updateKnowledgeItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? ({ ...item, ...updates, updatedAt: "Just now", updatedBy: "You" } as KnowledgeItem)
          : item
      ),
      editingItem: null,
    })),
}));

// =============================================================================
// Import job tracker (shared by new uploads and resumed-after-reload imports)
// =============================================================================

async function trackImportJob(
  jobId: string,
  meta: { datasetName: string | null; category: string | null; fileName: string | null }
): Promise<void> {
  const { setState, getState } = useKnowledgeStore;
  saveActiveImport({ jobId, ...meta });
  setState((state) => ({
    upload: {
      ...state.upload,
      ...meta,
      phase: "processing",
      jobId,
      uploadProgress: 100,
      processingProgress: state.upload.jobId === jobId ? state.upload.processingProgress : 0,
      errorMessage: null,
    },
  }));

  try {
    const finalJob = await knowledgeService.pollImportJob(jobId, (job) => {
      setState((state) => ({
        upload: {
          ...state.upload,
          processingProgress: Math.round(job.progress_percent ?? 0),
          currentStage: job.current_stage,
          rowCount: job.row_count,
          processedRows: job.processed_rows,
        },
      }));
    });

    saveActiveImport(null);
    setState((state) => ({
      upload: { ...state.upload, phase: "done", processingProgress: 100 },
    }));

    // Refresh knowledge list in background
    setTimeout(() => {
      getState().fetchItems(true, 1);
      getState().fetchCategoryCounts();
    }, 500);

    if (!getState().isAddDialogOpen) {
      const rows = finalJob.processed_rows ?? finalJob.row_count ?? 0;
      const label = meta.datasetName || meta.fileName || "Your file";
      toast.success(
        `${rows.toLocaleString()} records are mapped, indexed and ready to use.`,
        `"${label}" imported`
      );
      // Dialog is closed, so nothing else will clear the finished state.
      setState({ upload: INITIAL_UPLOAD_STATE });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Import failed";
    const stillRunning = msg.startsWith("Import is still running");
    if (!stillRunning) saveActiveImport(null);
    setState((state) => ({
      upload: { ...state.upload, phase: "error", errorMessage: msg },
    }));
    if (!getState().isAddDialogOpen) {
      const label = meta.datasetName || meta.fileName || "Import";
      if (stillRunning) toast.info(msg, `"${label}" is still importing`);
      else toast.error(msg, `"${label}" failed`);
      setState({ upload: INITIAL_UPLOAD_STATE });
    }
    throw new Error(msg);
  }
}
