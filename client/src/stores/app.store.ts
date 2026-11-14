import { create } from "zustand";

interface AppState {
  activeWorkspaceId: string | null;
  activeViewMode: "list" | "grid";
  breadcrumbs: Array<{ label: string; href?: string }>;

  // Actions
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  setActiveViewMode: (mode: "list" | "grid") => void;
  setBreadcrumbs: (breadcrumbs: Array<{ label: string; href?: string }>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeWorkspaceId: null,
  activeViewMode: "list",
  breadcrumbs: [],

  setActiveWorkspaceId: (workspaceId) => set({ activeWorkspaceId: workspaceId }),
  setActiveViewMode: (mode) => set({ activeViewMode: mode }),
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
}));
