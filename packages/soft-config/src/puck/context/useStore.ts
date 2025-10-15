import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { AppStore, createSoftConfigStore } from "../store";

export const appStoreContext = createContext(createSoftConfigStore());

// Create a hook factory similar to createUsePuck from @measured/puck
export const createUseSoftConfig = () => {
  // eslint-disable-next-line no-unused-vars
  return function useSoftConfig<T>(selector: (state: AppStore) => T) {
    const context = useContext(appStoreContext);
    return useStore(context, selector);
  };
};

// Default hook instance for convenience
export const useSoftConfig = createUseSoftConfig();

