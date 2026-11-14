import { create } from "zustand";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, "id">) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newItem: NotificationItem = {
      id,
      durationMs: 5000,
      ...notification,
    };

    set((state) => ({
      notifications: [...state.notifications, newItem],
    }));

    return id;
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}));

/**
 * Convenient toast dispatchers
 */
export const toast = {
  success: (message: string, title?: string, durationMs = 5000) =>
    useNotificationStore
      .getState()
      .addNotification({ type: "success", message, title, durationMs }),
  error: (message: string, title?: string, durationMs = 7000) =>
    useNotificationStore.getState().addNotification({ type: "error", message, title, durationMs }),
  warning: (message: string, title?: string, durationMs = 6000) =>
    useNotificationStore
      .getState()
      .addNotification({ type: "warning", message, title, durationMs }),
  info: (message: string, title?: string, durationMs = 5000) =>
    useNotificationStore.getState().addNotification({ type: "info", message, title, durationMs }),
  dismiss: (id: string) => useNotificationStore.getState().removeNotification(id),
  clear: () => useNotificationStore.getState().clearAll(),
};
