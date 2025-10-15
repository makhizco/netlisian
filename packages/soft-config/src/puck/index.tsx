// export store
export * from "./store";

// export context and selector
export { SoftConfigProvider } from "./context/storeProvider";
export { useSoftConfig, createUseSoftConfig } from "./context/useStore";

// export types
export type { SoftComponent, SoftComponents } from "./types/SoftComponent";

// export actions
export * from "./actions";

// export overrides
export * from "./overrides";

// export notification handler
export { setNotificationHandler, notify } from "./lib/notify";

// export confirmation handler
export { setConfirmHandler, confirm } from "./lib/confirm";

export { resolveSoftConfig } from "./lib/resolve-soft-config";