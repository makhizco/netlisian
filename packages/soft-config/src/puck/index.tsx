// export store
export * from "./store";

// export context and selector
export { SoftConfigProvider } from "./context/storeProvider";
export { useSoftConfig, createUseSoftConfig } from "./context/useStore";

// export types
export type { SoftComponent, SoftComponents, VersionedSoftComponent } from "./types/SoftComponent";
export type { Overrides } from "./types/Overrides";
export type { BuilderConfig, BuilderComponentConfig, BuilderRootConfig } from "./types/BuilderConfig";
export type { ActionEventPayload, OnActionsCallback } from "./types/ActionEvents";
export type {
	CustomFieldDefinition,
	CustomFieldReturnType,
	CustomFields,
	FieldSettings,
	SoftFieldDefinition,
	SoftFieldSettings,
} from "./types/SoftFields";

// export actions
export * from "./actions";

// export overrides
export * from "./overrides";

// export notification handler
export { setNotificationHandler, notify } from "./lib/notify";

// export confirmation handler
export { setConfirmHandler, confirm } from "./lib/confirm";

// export action callback
export { createActionCallback } from "./lib/action-callback";

export { resolveSoftConfig } from "./lib/resolve-soft-config";

// Export modal
export { Modal } from "./components/modal";

// Export mapping utilities for overrides.map consumers
export { filterToOptionsForFrom } from "./lib/builder/generate-field-options";

// Export apply-mapping utilities
export { applyMapping, resolveValueByPath } from "./lib/apply-mapping";
export type { MapEntry, ApplyMappingOptions, ApplyMappingResult } from "./types/Mapping";

// Export array-field utilities for mapping UI use
export { isArrayMappingPath, getArrayBasePath, getArrayItemSubPath } from "./lib/array-field-utils";