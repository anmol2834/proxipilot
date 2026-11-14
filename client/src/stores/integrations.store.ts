"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  ConnectedIntegrationAccount,
  ConnectionStatus,
  IntegrationProvider,
  IntegrationRequestPayload,
} from "@/types/integrations.types";

interface IntegrationsState {
  accounts: ConnectedIntegrationAccount[];
  isConnectModalOpen: boolean;
  isDisconnectModalOpen: boolean;
  accountToDisconnect: ConnectedIntegrationAccount | null;
  isRequestModalOpen: boolean;
  isDetailModalOpen: boolean;
  selectedAccountForDetail: ConnectedIntegrationAccount | null;
  requestedTools: IntegrationRequestPayload[];

  // Actions
  setConnectModalOpen: (open: boolean) => void;
  openDisconnectModal: (account: ConnectedIntegrationAccount) => void;
  closeDisconnectModal: () => void;
  setRequestModalOpen: (open: boolean) => void;
  openDetailModal: (account: ConnectedIntegrationAccount) => void;
  closeDetailModal: () => void;

  connectGmailAccount: (email: string, displayName?: string) => Promise<ConnectedIntegrationAccount>;
  disconnectAccount: (id: string) => void;
  reconnectAccount: (id: string) => void;
  triggerManualSync: (id: string) => void;
  submitIntegrationRequest: (payload: IntegrationRequestPayload) => void;
  getAccountById: (id: string) => ConnectedIntegrationAccount | undefined;
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set, get) => ({
      accounts: [],
      isConnectModalOpen: false,
      isDisconnectModalOpen: false,
      accountToDisconnect: null,
      isRequestModalOpen: false,
      isDetailModalOpen: false,
      selectedAccountForDetail: null,
      requestedTools: [],

      setConnectModalOpen: (open) => set({ isConnectModalOpen: open }),

      openDisconnectModal: (account) =>
        set({ isDisconnectModalOpen: true, accountToDisconnect: account }),

      closeDisconnectModal: () =>
        set({ isDisconnectModalOpen: false, accountToDisconnect: null }),

      setRequestModalOpen: (open) => set({ isRequestModalOpen: open }),

      openDetailModal: (account) =>
        set({ isDetailModalOpen: true, selectedAccountForDetail: account }),

      closeDetailModal: () =>
        set({ isDetailModalOpen: false, selectedAccountForDetail: null }),

      connectGmailAccount: async (email: string, displayName?: string) => {
        // Real connection is handled by useIntegrations().connectGmail
        set({ isConnectModalOpen: false });
        return {} as ConnectedIntegrationAccount;
      },

      disconnectAccount: (id: string) => {
        set({
          isDisconnectModalOpen: false,
          accountToDisconnect: null,
          selectedAccountForDetail: null,
          isDetailModalOpen: false,
        });
      },

      reconnectAccount: (id: string) => {
        // Handled by useIntegrations().reconnectAccount
      },

      triggerManualSync: (id: string) => {
        // Handled by useIntegrations().triggerManualSync
      },

      submitIntegrationRequest: (payload: IntegrationRequestPayload) => {
        set((state) => ({
          requestedTools: [...state.requestedTools, payload],
          isRequestModalOpen: false,
        }));
      },

      getAccountById: (id: string) => {
        return undefined;
      },
    }),
    {
      name: "proxipilot_integrations_storage",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
      partialize: (state) => ({
        // Never persist accounts in localStorage — server is single source of truth
        requestedTools: state.requestedTools,
      }),
    }
  )
);
