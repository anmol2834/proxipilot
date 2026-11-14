import { create } from "zustand";

export type ThemeMode = "light" | "dark";

interface UIState {
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  activeModal: string | null;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapse: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  themeMode: "light",
  sidebarOpen: false,
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activeModal: null,

  setThemeMode: (mode) => set({ themeMode: mode }),
  toggleThemeMode: () =>
    set((state) => ({ themeMode: state.themeMode === "light" ? "dark" : "light" })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapse: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
}));
