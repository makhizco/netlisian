import { DefaultComponentProps } from "@measured/puck";
import { create, StoreApi } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  // eslint-disable-next-line no-redeclare
  History,
  ComponentConfig,
  Config,
  
  PuckAction,
  OnAction,
} from "@measured/puck";

import { rootActionHandler } from "../lib/root-action-handler";

import { BuildersSlice, createBuildersSlice } from "./slices/builder";
import { SoftComponent, SoftComponents } from "../types/SoftComponent";
import { createVersionedComponentConfig } from "../lib/create-versioned-component-config";
import {
  buildInitialSoftComponents,
  hydrateSoftComponentsTransforms,
  buildReverseDependencyGraph,
} from "../lib/build-initial-soft-components";
import { Overrides } from "../types/Overrides";
import { OnActionsCallback } from "../types/ActionEvents";
import type { CustomFields } from "../types/SoftFields";

/** Represents the current editing mode of the Puck editor. */
export type Status =
  | "building"
  | "remodeling"
  | "ready"
  | "cancelling"
  | "assessing"
  | "inspecting";

export type AppStore = {
  // ─── Puck Config ────────────────────────────────────────────────────────────

  /** The current merged Puck config (hard + soft components). Rebuilt on soft component changes. */
  softConfig: Config;

  /** Flat map of all registered soft components, keyed by component name. */
  softComponents: SoftComponents;

  /**
   * Soft components after `hydrateMapTransform` has been applied.
   * Only populated when `overrides.hydrateMapTransform` is provided.
   */
  hydratedSoftComponents?: SoftComponents;

  // ─── Editor State ────────────────────────────────────────────────────────────

  /** The current editing mode. Controls which components can be mutated. */
  state: Status;

  /** Snapshot of Puck history entries saved before an editing session starts. */
  originalHistory: History[];

  /** A stored copy of the Puck config, used for rollback scenarios. */
  storedConfig?: Config;

  // ─── Configuration ────────────────────────────────────────────────────────────

  /** Lifecycle and rendering overrides forwarded from the SoftConfigProvider. */
  overrides: Overrides;

  /** Custom field definitions to extend the built-in Puck field types. */
  customFields: CustomFields;

  /**
   * Callback fired on every Puck action dispatch.
   * Gives consumers a hook to react to drag-and-drop, insert, remove, etc.
   */
  onActions?: OnActionsCallback;

  // ─── Item Selection ──────────────────────────────────────────────────────────

  /** The currently selected component in the Puck canvas, or null if none. */
  itemSelector: { index: number; zone: string } | null;

  /** Update or clear the active item selection. */
  setItemSelector: (selector: { index: number; zone: string } | null) => void;

  /** Snapshot of the selected component's props before any edits began. Used for cancel/rollback. */
  originalItem: DefaultComponentProps | null;

  /** Persist the pre-edit props snapshot for the active item. */
  setOriginalItem: (item: DefaultComponentProps | null) => void;

  // ─── History ─────────────────────────────────────────────────────────────────

  /** Persist the full Puck history stack (called when entering an editing session). */
  storeHistory: (history: History[]) => void;

  /** Clear the stored history (called when an editing session completes or cancels). */
  removeHistory: () => void;

  // ─── Soft Component CRUD ──────────────────────────────────────────────────────

  /**
   * Register or update a single soft component's Puck config.
   * Optionally assigns the component to a Puck category.
   */
  setSoftComponentConfig: (
    key: string,
    config: ComponentConfig,
    category?: string,
  ) => void;

  /** Remove a soft component's Puck config entry by key. */
  removeSoftComponentConfig: (key: string) => void;

  /**
   * Delete a specific version of a soft component.
   * If the deleted version was the default, promotes the most recent remaining version.
   */
  removeSoftComponentVersion: (key: string, version: string) => void;

  /** Register or update a Puck category (visibility, expansion, membership). */
  setSoftCategoryConfig: (
    key: string,
    category: {
      components?: string[];
      visible?: boolean;
      defaultExpanded?: boolean;
      title?: string;
    },
  ) => void;

  /** Remove a Puck category entry by key. */
  removeSoftCategoryConfig: (key: string) => void;

  /** Builder sub-slice — handles multi-step build/remodel workflows. */
  builder: BuildersSlice;

  /**
   * Upsert a single version of a soft component.
   * Creates the component entry if it doesn't already exist.
   */
  setSoftComponent: (
    key: string,
    version: string,
    component: SoftComponent,
  ) => void;

  /**
   * Batch-upsert multiple soft components at once.
   * Merges incoming versions with any existing versions for each component.
   */
  setSoftComponents: (components: SoftComponents) => void;

  /**
   * Re-apply `overrides.hydrateMapTransform` to the current soft components.
   * Call this when the transform function or its dependencies change at runtime.
   */
  hydrateTransforms: () => void;

  /**
   * Promote a specific version of a soft component to be the active/default version.
   * Rebuilds the Puck config entry for that component.
   */
  setSoftComponentDefaultVersion: (key: string, version: string) => void;

  /** Completely remove a soft component and all its versions from the store. */
  removeSoftComponent: (key: string) => void;

  // ─── Editing State ───────────────────────────────────────────────────────────

  /** Name of the component type currently being edited (e.g. "Hero"), or null. */
  editingComponent: string | null;

  /** Instance ID of the component currently being edited in the Puck canvas, or null. */
  editingComponentId: string | null;

  /**
   * Set of component instance IDs the user is allowed to mutate in the current session.
   * Populated when entering "building" or "remodeling" state.
   */
  editableComponentIds: Set<string>;

  /** Overwrite the entire set of editable component IDs. */
  setEditableComponentIds: (ids: Set<string>) => void;

  /** Append a single component instance ID to the editable set. */
  addEditableComponentId: (id: string) => void;

  /** Reset editing state: clears editingComponentId and editableComponentIds. */
  clearEditingState: () => void;

  // ─── Dependency Graph ─────────────────────────────────────────────────────────

  /**
   * Reverse dependency graph: componentName → Set of component names that depend on it.
   * Built once on store creation and updated when components change.
   * Used to efficiently cascade Puck config rebuilds to affected dependents.
   */
  dependencyGraph: Map<string, Set<string>>;

  /**
   * Rebuild the Puck config entries for every component that depends on the given one.
   * Should be called after a soft component's render or schema changes.
   *
   * @param componentName - The component that was updated.
   * @param version - The version that changed (for future granular diffing).
   */
  rebuildDependents: (componentName: string, version: string) => void;

  // ─── Iframe ──────────────────────────────────────────────────────────────────

  /**
   * Mutable ref holding the Puck iframe's Document.
   * Stored as a ref object to mutate without triggering Zustand subscribers.
   */
  iframeDoc: Document | null;
  /**
   * Point the store at a new iframe Document.
   * Immediately applies or clears edit-visibility CSS based on the current state.
   */
  setIframeDoc: (doc: Document | null) => void;

  // ─── UI Flags ────────────────────────────────────────────────────────────────

  /**
   * When true, version-selection fields are shown in the Puck sidebar.
   * Defaults to true; set to false to hide version controls from end users.
   */
  showVersionFields: boolean;

  /** Toggle the visibility of version-selection fields in the Puck sidebar. */
  setShowVersionFields: (show: boolean) => void;

  // ─── Action Validation ───────────────────────────────────────────────────────

  /**
   * Reference to Puck's `history.back` function, injected by the UndoSync
   * component that lives inside the ActionBar override.
   * Null until the Puck editor mounts and ActionBar renders.
   */
  undoFn: (() => void) | null;

  /**
   * Called by UndoSync (inside the Puck tree) to register the live undo function.
   * Must be called once per editor mount so `validateAction` can trigger rollbacks.
   */
  setUndoFn: (fn: () => void) => void;

  /**
   * Guard function passed to Puck's `onAction` via `createActionCallback`.
   * Returns false for any action that targets a component outside the current
   * editable set, which causes `createActionCallback` to immediately undo it.
   *
   * Always returns true when `state === "ready"` (no restrictions apply).
   */
  validateAction: (action: PuckAction, previousAction?: PuckAction) => boolean;

  /** Names of the content areas where soft components can be built. */
  contentAreaNames?: string[];

  /** Setter for the content area names */
  setContentAreaNames: (names?: string[]) => void;

  /** Access to the puck dispatch function, stored during edits. */
  puckDispatch?: ((action: PuckAction) => void) | null;

  /** Setter for the puck dispatch function */
  setPuckDispatch: (dispatch: ((action: PuckAction) => void) | null) => void;

  /**
   * Optional root action handler injected via the store creation.
   */
  rootActionHandler?: OnAction;
};

export type AppStoreApi = StoreApi<AppStore>;

export const createSoftConfigStore = (
  hardConfig: Config = { components: {} },
  softComponents: SoftComponents = {},
  overrides: Overrides = {},
  onActions?: OnActionsCallback,
  showVersionFields = true,
  customFields: CustomFields = {},
  contentAreaNames?: string[],
) => {
  // Strip any soft components that clash with hard config entries so they
  // don't accidentally override non-editable base components.
  const normalizedSoftComponents = Object.fromEntries(
    Object.entries(softComponents || {})
      .filter(([key]) => !hardConfig.components || !hardConfig.components[key])
      .map(([key, value]) => [key, { ...value, name: value.name || key }]),
  ) as SoftComponents;

  // Stored as a plain object ref so mutations don't fan out to subscribers.
  const iframeDoc = null;

  const hydratedSoftComponents = overrides?.hydrateMapTransform
    ? hydrateSoftComponentsTransforms(
        normalizedSoftComponents,
        overrides.hydrateMapTransform,
      )
    : normalizedSoftComponents;

  const initialDependencyGraph = buildReverseDependencyGraph(
    hydratedSoftComponents,
  );

  return create<AppStore>()(
    subscribeWithSelector((set, get) => ({
      // ─── Initial State ──────────────────────────────────────────────────────

      state: "ready",
      originalHistory: [],
      overrides,
      customFields,
      onActions,
      iframeDoc,
      editingComponent: null,
      editingComponentId: null,
      editableComponentIds: new Set(),
      itemSelector: null,
      originalItem: null,
      hydratedSoftComponents,
      softComponents: hydratedSoftComponents,
      dependencyGraph: initialDependencyGraph,
      showVersionFields,
      contentAreaNames,
      setContentAreaNames: (names) => set({ contentAreaNames: names }),
      puckDispatch: null,
      setPuckDispatch: (dispatch) => set({ puckDispatch: dispatch }),
      rootActionHandler: rootActionHandler(set, get),

      // ─── Initial softConfig ─────────────────────────────────────────────────

      softConfig: {
        ...hardConfig,
        components: {
          ...hardConfig.components,
          ...buildInitialSoftComponents(
            hardConfig,
            hydratedSoftComponents,
            overrides,
            showVersionFields,
            customFields,
          ),
        },
        categories: { ...(hardConfig.categories || {}) },
      },

      // ─── UI Flags ───────────────────────────────────────────────────────────

      setShowVersionFields: (show) => set({ showVersionFields: show }),

      // ─── Iframe ─────────────────────────────────────────────────────────────

      setIframeDoc: (doc) =>
        set({
          iframeDoc: doc,
        }),

      // ─── History ────────────────────────────────────────────────────────────

      storeHistory: (history) => set({ originalHistory: history }),
      removeHistory: () => set({ originalHistory: [] }),

      // ─── Item Selection ─────────────────────────────────────────────────────

      setItemSelector: (selector) => set({ itemSelector: selector }),
      setOriginalItem: (item) => set({ originalItem: item }),

      // ─── Editing State ──────────────────────────────────────────────────────

      setEditableComponentIds: (ids) => set({ editableComponentIds: ids }),

      addEditableComponentId: (id) =>
        set((state) => {
          const newIds = new Set(state.editableComponentIds);
          newIds.add(id);
          return { editableComponentIds: newIds };
        }),

      clearEditingState: () =>
        set({ editingComponentId: null, editableComponentIds: new Set() }),

      // ─── Action Validation ──────────────────────────────────────────────────

      undoFn: null,
      setUndoFn: (fn) => set({ undoFn: fn }),

      validateAction: (action, previousAction) => {
        const { state, editableComponentIds, addEditableComponentId } = get();

        // No restrictions when the editor is in its default "ready" state.
        if (state === "ready") return true;

        // ── replace ────────────────────────────────────────────────────────────
        // Most frequent action type; checked first for performance.
        // Allows replacing a component if:
        //   (a) the component itself is in the editable set, or
        //   (b) it's being dropped into a zone owned by an editable parent,
        //       in which case we also admit the new child to the editable set.
        if (action.type === "replace") {
          if (
            previousAction?.type === "insert" &&
            previousAction?.id === action.data.props.id
          ) {
            return true;
          }
          const parentId = action.destinationZone?.split(":")[0];

          if (
            action.data.props.id &&
            editableComponentIds.has(action.data.props.id)
          ) {
            return true;
          }
          if (parentId && editableComponentIds.has(parentId)) {
            addEditableComponentId(action.data.props.id);
            return true;
          }
          return false;
        }

        // ── insert / duplicate ─────────────────────────────────────────────────
        // Block drops into zones whose parent is not editable.
        // On a successful insert, register the brand-new child ID as editable
        // so the user can immediately interact with it.
        if (action.type === "insert" || action.type === "duplicate") {
          const zone =
            action.type === "insert"
              ? action.destinationZone
              : action.sourceZone;
          const parentId = zone?.split(":")[0];

          const isEditable = parentId && editableComponentIds.has(parentId);
          if (!isEditable && action.type === "duplicate") return false;

          if (action.type === "insert" && action.id && isEditable) {
            addEditableComponentId(action.id);
          }
        }

        // ── remove / move / reorder ────────────────────────────────────────────
        // These all require the destination zone's parent to be editable.
        // (For remove we use the source zone, since there is no destination.)
        if (
          action.type === "remove" ||
          action.type === "move" ||
          action.type === "reorder"
        ) {
          const zone =
            action.type === "remove" ? action.zone : action.destinationZone;
          const parentId = zone?.split(":")[0];

          if (parentId && !editableComponentIds.has(parentId)) return false;
          return true;
        }

        // All other action types (registerZone, setData, etc.) are unrestricted.
        return true;
      },

      // ─── Soft Component CRUD ─────────────────────────────────────────────────

      setSoftComponent: (name, version, component) => {
        if (hardConfig.components?.[name]) {
          console.warn(
            `Cannot set soft component "${name}" because it conflicts with a hardConfig component.`,
          );
          return;
        }

        const existing = get().softComponents[name];

        set((state) => ({
          softComponents: {
            ...state.softComponents,
            [name]: {
              ...existing,
              name: component.name || existing?.name || name,
              category: component.category ?? existing?.category,
              defaultVersion: version,
              versions: {
                ...(state.softComponents[name]?.versions || {}),
                [version]: component,
              },
            },
          },
        }));
      },

      setSoftComponents: (incomingComponents) => {
        const state = get();
        const nextSoftComponents = { ...state.softComponents };
        const nextConfigComponents = { ...state.softConfig.components };

        Object.entries(incomingComponents).forEach(([name, data]) => {
          // Never overwrite hard config components.
          if (hardConfig.components?.[name]) return;

          const existing = nextSoftComponents[name];

          const merged = existing
            ? {
                ...existing,
                ...data,
                name: data.name || existing.name || name,
                versions: { ...existing.versions, ...data.versions },
              }
            : data;

          merged.name = merged.name || name;
          nextSoftComponents[name] = merged;

          const activeVersion = merged.defaultVersion;
          const activeVersionData = merged.versions[activeVersion];

          if (activeVersionData) {
            nextConfigComponents[name] = createVersionedComponentConfig(
              name,
              merged.name,
              activeVersion,
              Object.keys(merged.versions),
              state.softConfig,
              nextSoftComponents,
              activeVersionData.defaultProps,
              state.showVersionFields,
              state.customFields,
            );
          }
        });

        set({
          softComponents: nextSoftComponents,
          softConfig: { ...state.softConfig, components: nextConfigComponents },
        });
      },

      hydrateTransforms: () => {
        const { overrides, softComponents, softConfig } = get();
        if (!overrides?.hydrateMapTransform) return;

        const hydratedComponents = hydrateSoftComponentsTransforms(
          softComponents,
          overrides.hydrateMapTransform,
        );

        const nextConfigComponents = { ...softConfig.components };

        Object.entries(hydratedComponents).forEach(([name, componentData]) => {
          const activeVersion = componentData.defaultVersion;
          const activeVersionData = componentData.versions[activeVersion];

          if (activeVersionData) {
            nextConfigComponents[name] = createVersionedComponentConfig(
              name,
              componentData.name || name,
              activeVersion,
              Object.keys(componentData.versions),
              softConfig,
              hydratedComponents,
              activeVersionData.defaultProps,
              get().showVersionFields,
              get().customFields,
            );
          }
        });

        set({
          softComponents: hydratedComponents,
          softConfig: { ...softConfig, components: nextConfigComponents },
        });
      },

      setSoftComponentDefaultVersion: (name, version) => {
        const state = get();
        const softComponent = state.softComponents[name]?.versions?.[version];

        if (!softComponent) {
          throw new Error(
            `Soft component "${name}" version "${version}" does not exist.`,
          );
        }

        const allVersions = Object.keys(
          state.softComponents[name]?.versions || {},
        );
        const displayName = state.softComponents[name]?.name || name;

        const newConfig = createVersionedComponentConfig(
          name,
          displayName,
          version,
          allVersions,
          state.softConfig,
          state.softComponents,
          softComponent.defaultProps,
          state.showVersionFields,
          state.customFields,
        );

        set((s) => ({
          softConfig: {
            ...s.softConfig,
            components: { ...s.softConfig.components, [name]: newConfig },
          },
          softComponents: {
            ...s.softComponents,
            [name]: { ...s.softComponents[name], defaultVersion: version },
          },
        }));
      },

      removeSoftComponentVersion: (key, version) => {
        set((state) => {
          const component = state.softComponents[key];
          if (!component) return {};

          const newVersions = Object.fromEntries(
            Object.entries(component.versions || {}).filter(
              ([k]) => k !== version,
            ),
          );

          // If the deleted version was the default, promote the newest remaining one.
          let newDefaultVersion = component.defaultVersion;
          if (component.defaultVersion === version) {
            const versionKeys = Object.keys(newVersions);
            newDefaultVersion =
              versionKeys.length > 0 ? versionKeys[versionKeys.length - 1] : "";
          }

          return {
            softComponents: {
              ...state.softComponents,
              [key]: {
                ...component,
                versions: newVersions,
                defaultVersion: newDefaultVersion,
              },
            },
          };
        });
      },

      removeSoftComponent: (key) =>
        set((state) => ({
          softComponents: Object.fromEntries(
            Object.entries(state.softComponents).filter(([k]) => k !== key),
          ),
        })),

      setSoftComponentConfig: (key, config, category) => {
        set((state) => ({
          softConfig: {
            ...state.softConfig,
            components: {
              ...state.softConfig.components,
              [key]: { ...config },
            },
            categories: category
              ? {
                  ...(state.softConfig.categories || {}),
                  [category]: {
                    ...(state.softConfig.categories?.[category] || {}),
                    components: [
                      ...(state.softConfig.categories?.[category]?.components ||
                        []),
                      key,
                    ],
                  },
                }
              : state.softConfig.categories || {},
          },
        }));
      },

      removeSoftComponentConfig: (key) =>
        set((state) => ({
          softConfig: {
            ...state.softConfig,
            components: Object.fromEntries(
              Object.entries(state.softConfig.components).filter(
                ([k]) => k !== key,
              ),
            ),
          },
        })),

      setSoftCategoryConfig: (key, category) =>
        set((state) => ({
          softConfig: {
            ...state.softConfig,
            categories: {
              ...state.softConfig.categories,
              [key]: { ...state.softConfig.categories?.[key], ...category },
            },
          },
        })),

      removeSoftCategoryConfig: (key) =>
        set((state) => ({
          softConfig: {
            ...state.softConfig,
            categories: Object.fromEntries(
              Object.entries(state.softConfig.categories || {}).filter(
                ([k]) => k !== key,
              ),
            ),
          },
        })),

      // ─── Builder Slice ────────────────────────────────────────────────────────

      builder: createBuildersSlice(set, get),

      // ─── Dependency Graph ─────────────────────────────────────────────────────

      rebuildDependents: (componentName) => {
        const state = get();
        const dependents =
          state.dependencyGraph.get(componentName) || new Set();
        if (dependents.size === 0) return;

        const nextConfig = { ...state.softConfig };
        const { softComponents } = state;

        for (const dependentName of Array.from(dependents)) {
          const dependent = softComponents[dependentName];
          const defaultVersion =
            dependent.defaultVersion ||
            Object.keys(dependent.versions || {}).pop();

          if (!defaultVersion) continue;

          const versionedComponent = dependent.versions[defaultVersion];
          if (!versionedComponent) continue;

          nextConfig.components[dependentName] = createVersionedComponentConfig(
            dependentName,
            dependent.name || dependentName,
            defaultVersion,
            Object.keys(dependent.versions || {}),
            nextConfig,
            softComponents,
            versionedComponent.defaultProps,
            state.showVersionFields,
            state.customFields,
          );
        }

        set((s) => ({ ...s, softConfig: nextConfig }));
      },
    })),
  );
};
