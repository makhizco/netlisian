import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import type { AppStore } from "../store";

export const appStoreContext = createContext<StoreApi<AppStore> | null>(null);

// Create a hook factory similar to createUsePuck from @measured/puck
export const createUseSoftConfig = () => {
  // eslint-disable-next-line no-unused-vars
  return function useSoftConfig<T>(selector: (state: AppStore) => T) {
    const context = useContext(appStoreContext);
    if (!context) {
      throw new Error(
        "useSoftConfig must be used inside a SoftConfigProvider. Wrap your tree with <SoftConfigProvider value={store}>"
      );
    }

    return useStore(context, selector);
  };
};

// Default hook instance for convenience
export const useSoftConfig = createUseSoftConfig();

