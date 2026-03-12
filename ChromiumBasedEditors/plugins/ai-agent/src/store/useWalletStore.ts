import { create } from "zustand";
import type { TCloud } from "@/index";
import type { Model } from "@/lib/types";
import { provider } from "@/providers";

const WALLET_ACTIVE_KEY = "wallet_active";
const WALLET_SELECTED_CLOUD_KEY = "wallet_selected_cloud";

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

type WalletInfo = {
  email: string;
  payer: WalletPayer;
  balance: WalletBalance;
};

type WalletState = {
  isWalletActive: boolean;
  selectedCloud: TCloud | null;
  walletModels: Model[];
  walletInfo: WalletInfo | null;
  setWalletActive: (active: boolean) => void;
  setSelectedCloud: (cloud: TCloud) => void;
  fetchSelectedCloud: () => void;
  fetchWalletModels: () => Promise<void>;
  fetchWalletInfo: () => Promise<void>;
};

const useWalletStore = create<WalletState>()((set, get) => ({
  isWalletActive: (() => {
    const saved = localStorage.getItem(WALLET_ACTIVE_KEY);
    return saved ? JSON.parse(saved) : false;
  })(),
  selectedCloud: (() => {
    const saved = localStorage.getItem(WALLET_SELECTED_CLOUD_KEY);
    return saved ? JSON.parse(saved) : null;
  })(),
  walletModels: [],
  walletInfo: null,
  setWalletActive: (active) => {
    localStorage.setItem(WALLET_ACTIVE_KEY, JSON.stringify(active));
    set({ isWalletActive: active });
  },
  setSelectedCloud: (cloud) => {
    localStorage.setItem(WALLET_SELECTED_CLOUD_KEY, JSON.stringify(cloud));
    set({ selectedCloud: cloud, walletInfo: null });
  },
  fetchSelectedCloud: () => {
    const saved = localStorage.getItem(WALLET_SELECTED_CLOUD_KEY);
    const cloud: TCloud | null = saved ? JSON.parse(saved) : null;
    set({ selectedCloud: cloud });
  },
  fetchWalletModels: async () => {
    const cloud = get().selectedCloud;
    if (!cloud) return;

    try {
      const models = await provider.getProvidersModels([
        {
          type: "wallet",
          name: "Wallet",
          key: cloud.data.apiKey,
          baseUrl: cloud.url,
        },
      ]);

      set({ walletModels: models.get("Wallet") ?? [] });
    } catch (err) {
      console.error("Failed to fetch wallet models:", err);
    }
  },
  fetchWalletInfo: async () => {
    const cloud = get().selectedCloud;
    if (!cloud) return;

    try {
      const baseUrl = cloud.url.replace(/\/+$/, "");
      const headers: HeadersInit = cloud.data.apiKey
        ? { Authorization: `Bearer ${cloud.data.apiKey}` }
        : {};

      const [balanceRes, customerInfoRes] = await Promise.all([
        fetch(`${baseUrl}/api/2.0/portal/payment/customer/balance`, {
          headers,
        }),
        fetch(`${baseUrl}/api/2.0/portal/payment/customerinfo`, { headers }),
      ]);

      const [balanceData, customerInfoData] = await Promise.all([
        balanceRes.json(),
        customerInfoRes.json(),
      ]);

      const customerInfo = customerInfoData.response;
      const balance = balanceData.response;

      set({
        walletInfo: {
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
        },
      });
    } catch (err) {
      console.error("Failed to fetch wallet info:", err);
    }
  },
}));

export default useWalletStore;
export type { WalletPayer, WalletBalance, WalletInfo };
