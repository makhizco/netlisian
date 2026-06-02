import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import type { AppStore } from "../store";

export const appStoreContext = createContext<StoreApi<AppStore> | null>(null);

// Create a hook factory similar to createUsePuck from @measured/puck
export const createUseSoftConfig = () => {
  // eslint-disable-next-line no-unused-vars
  return function useSoftConfig<T>(
    selector: (state: AppStore) => T,
    equalityFn?: (a: T, b: T) => boolean
  ): T {
    const context = useContext(appStoreContext);
    if (!context) {
      throw new Error(
        "useSoftConfig must be used inside a SoftConfigProvider. Wrap your tree with <SoftConfigProvider value={store}>"
      );
    }

    // Use type assertion to work around zustand's strict typing
    if (equalityFn) {
      return (useStore as any)(context, selector, equalityFn);
    }
    return useStore(context, selector);
  };
};

// Default hook instance for convenience
export const useSoftConfig = createUseSoftConfig();

/**
 * Access the soft config store instance without subscribing to state changes.
 */
export const useSoftConfigStore = () => {
  const context = useContext(appStoreContext);
  if (!context) {
    throw new Error(
      "useSoftConfigStore must be used inside a SoftConfigProvider."
    );
  }
  return context;
};

