import { create } from "zustand";
import type { Model } from "@/lib/types";
import { provider } from "@/providers";

const WALLET_PORTALS_KEY = "wallet_portals";
const WALLET_ACTIVE_KEY = "wallet_active";

type WalletPayer = {
  displayName: string;
  email: string;
  avatar: string;
  id: string;
};

type WalletBalance = {
  accountNumber: number;
  subAccounts: { amount: number; currency: string }[];
};

type WalletPortal = {
  url: string;
  key: string;
  portalId: string;
  email: string;
  payer: WalletPayer;
  balance: WalletBalance;
};

type WalletState = {
  isWalletActive: boolean;
  portals: WalletPortal[];
  selectedPortalId: string | null;
  walletModels: Model[];
  setWalletActive: (active: boolean) => void;
  addPortal: (portal: WalletPortal) => void;
  removePortal: (portalId: string) => void;
  setSelectedPortalId: (portalId: string) => void;
  refreshPortal: (portalId: string) => Promise<void>;
  fetchWalletModels: () => Promise<void>;
};

const useWalletStore = create<WalletState>()((set, get) => ({
  isWalletActive: (() => {
    const saved = localStorage.getItem(WALLET_ACTIVE_KEY);
    return saved ? JSON.parse(saved) : false;
  })(),
  walletModels: [],
  setWalletActive: (active) => {
    localStorage.setItem(WALLET_ACTIVE_KEY, JSON.stringify(active));
    set({ isWalletActive: active });
  },
  portals: (() => {
    const saved = localStorage.getItem(WALLET_PORTALS_KEY);
    return saved ? JSON.parse(saved) : [];
  })(),
  selectedPortalId: (() => {
    const saved = localStorage.getItem(WALLET_PORTALS_KEY);
    const portals: WalletPortal[] = saved ? JSON.parse(saved) : [];
    return portals.length > 0 ? portals[0].portalId : null;
  })(),
  addPortal: (portal) => {
    set((state) => {
      const exists = state.portals.some((p) => p.portalId === portal.portalId);
      const newPortals = exists
        ? state.portals.map((p) =>
            p.portalId === portal.portalId ? portal : p
          )
        : [...state.portals, portal];
      localStorage.setItem(WALLET_PORTALS_KEY, JSON.stringify(newPortals));
      return { portals: newPortals, selectedPortalId: portal.portalId };
    });
  },
  removePortal: (portalId) => {
    set((state) => {
      const newPortals = state.portals.filter((p) => p.portalId !== portalId);
      localStorage.setItem(WALLET_PORTALS_KEY, JSON.stringify(newPortals));
      const newSelected =
        state.selectedPortalId === portalId
          ? (newPortals[0]?.portalId ?? null)
          : state.selectedPortalId;
      return { portals: newPortals, selectedPortalId: newSelected };
    });
  },
  setSelectedPortalId: (portalId) => {
    set({ selectedPortalId: portalId });
  },
  refreshPortal: async (portalId) => {
    const portal = get().portals.find((p) => p.portalId === portalId);
    if (!portal) return;

    try {
      const headers: HeadersInit = portal.key
        ? { Authorization: `Bearer ${portal.key}` }
        : {};

      const [balanceRes, customerInfoRes] = await Promise.all([
        fetch(
          `onlyoffice-proxy://${portal.url}/api/2.0/portal/payment/customer/balance`,
          { headers }
        ),
        fetch(
          `onlyoffice-proxy://${portal.url}/api/2.0/portal/payment/customerinfo`,
          { headers }
        ),
      ]);

      const [balanceData, customerInfoData] = await Promise.all([
        balanceRes.json(),
        customerInfoRes.json(),
      ]);

      const customerInfo = customerInfoData.response;
      const balance = balanceData.response;

      const updatedPortal: WalletPortal = {
        ...portal,
        email: customerInfo.email,
        payer: {
          displayName: customerInfo.payer.displayName,
          email: customerInfo.email,
          avatar: customerInfo.payer.avatarMedium,
          id: customerInfo.payer.id,
        },
        balance: {
          accountNumber: balance.accountNumber,
          subAccounts: balance.subAccounts,
        },
      };

      set((state) => {
        const newPortals = state.portals.map((p) =>
          p.portalId === portalId ? updatedPortal : p
        );
        localStorage.setItem(WALLET_PORTALS_KEY, JSON.stringify(newPortals));
        return { portals: newPortals };
      });
    } catch (err) {
      console.error("Failed to refresh portal:", err);
    }
  },
  fetchWalletModels: async () => {
    const portal = get().portals.find(
      (p) => p.portalId === get().selectedPortalId
    );
    if (!portal) return;

    try {
      const models = await provider.getProvidersModels([
        {
          type: "wallet",
          name: "Wallet",
          key: portal.key,
          baseUrl: portal.url,
        },
      ]);

      set({ walletModels: models.get("Wallet") ?? [] });
    } catch (err) {
      console.error("Failed to fetch wallet models:", err);
    }
  },
}));

export default useWalletStore;
export type { WalletPortal, WalletPayer, WalletBalance };
