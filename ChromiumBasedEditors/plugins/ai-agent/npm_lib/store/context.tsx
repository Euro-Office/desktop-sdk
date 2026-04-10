import { createContext, type ReactNode, useContext } from "react";
import type { Stores } from "./create-stores";

const StoresContext = createContext<Stores | null>(null);

export function StoresProvider({
  stores,
  children,
}: {
  stores: Stores;
  children: ReactNode;
}) {
  return (
    <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>
  );
}

export function useStores(): Stores {
  const stores = useContext(StoresContext);
  if (!stores) {
    throw new Error("useStores must be used within a StoresProvider");
  }
  return stores;
}
