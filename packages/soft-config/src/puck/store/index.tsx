import { create, StoreApi } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  // eslint-disable-next-line no-redeclare
  History,
  ComponentConfig,
  Config,
  DefaultComponentProps,
} from "@measured/puck";

import { BuildersSlice, createBuildersSlice } from "./slices/builder";
import { SoftComponent, SoftComponents } from "../types/SoftComponent";
import { createVersionedComponentConfig } from "../lib/create-versioned-component-config";
import {
  buildInitialSoftComponents,
  hydrateSoftComponentsTransforms,
  buildReverseDependencyGraph,
} from "../lib/build-initial-soft-components";
import { clearEditVisibility, setEditVisibility } from "../lib/edit-visibility-utils";
import { Overrides } from "../types/Overrides";
import { OnActionsCallback } from "../types/ActionEvents";
import type { CustomFields } from "../types/SoftFields";

type Status = "building" | "remodeling" | "ready" | "inspecting";

export type AppStore = {
  softConfig: Config;
  softComponents: SoftComponents;
  hydratedSoftComponents?: SoftComponents;
  state: Status;
  originalHistory: History[];
  storedConfig?: Config;
  overrides: Overrides;
  customFields: CustomFields;
  onActions?: OnActionsCallback;
  itemSelector: {
    index: number;
    zone: string;
  } | null;
  setItemSelector: (selector: { index: number; zone: string } | null) => void;

  originalItem: DefaultComponentProps | null;
  setOriginalItem: (item: DefaultComponentProps | null) => void;

  storeHistory: (history: History[]) => void;
  removeHistory: () => void;

  setSoftComponentConfig: (
    key: string,
    config: ComponentConfig,
    category?: string
  ) => void;

  removeSoftComponentConfig: (key: string) => void;
  removeSoftComponentVersion: (key: string, version: string) => void;
  setSoftCategoryConfig: (
    key: string,
    category: {
      components?: string[];
      visible?: boolean;
      defaultExpanded?: boolean;
      title?: string;
    }
  ) => void;
  removeSoftCategoryConfig: (key: string) => void;
  builder: BuildersSlice;
  setSoftComponent: (
    key: string,
    version: string,
    component: SoftComponent
  ) => void;
  setSoftComponents: (components: SoftComponents) => void;
  hydrateTransforms: () => void;
  setSoftComponentDefaultVersion: (key: string, version: string) => void;
  removeSoftComponent: (key: string) => void;
  editingComponent: string | null;
  editingComponentId: string | null;
  editableComponentIds: Set<string>;
  setEditableComponentIds: (ids: Set<string>) => void;
  addEditableComponentId: (id: string) => void;
  clearEditingState: () => void;

  /**
   * Reverse dependency graph: componentName -> Set of components that depend on it
   * Used to efficiently rebuild dependent components when a soft component is updated
   */
  dependencyGraph: Map<string, Set<string>>;

  /**
   * Rebuild all dependent components after a soft component is updated
   * Only rebuilds components that depend on the changed component
   *
   * @param componentName - The component that was updated
   * @param version - The version that was updated
   */
  rebuildDependents: (componentName: string, version: string) => void;

  /**
   * Iframe document reference for applying styling and edit visibility
   * Stored as a mutable ref to avoid triggering store updates.
   */
  iframeDocRef: { current: Document | null };

  /**
   * Get the current iframe document reference
   */
  getIframeDoc: () => Document | null;

  /**
   * Set the iframe document reference without causing re-renders
   */
  setIframeDoc: (doc: Document | null) => void;

  /**
   * Flag to control visibility of version config fields
   */
  showVersionFields: boolean;

  /**
   * Toggle the visibility of version config fields
   */
  setShowVersionFields: (show: boolean) => void;
};

export type AppStoreApi = StoreApi<AppStore>;

export const createSoftConfigStore = (
  hardConfig: Config = {
    components: {},
  },
  softComponents: SoftComponents = {},
  overrides: Overrides = {},
  onActions?: OnActionsCallback,
  showVersionFields = true,
  customFields: CustomFields = {}
) => {
  const normalizedSoftComponents = Object.fromEntries(
    Object.entries(softComponents || {})
      .filter(([key]) => !hardConfig.components || !hardConfig.components[key])
      .map(([key, value]) => [
        key,
        {
          ...value,
          name: value.name || key,
        },
      ])
  ) as SoftComponents;

  const iframeDocRef = { current: null as Document | null };
  const hydratedSoftComponents =
    overrides?.hydrateMapTransform
      ? hydrateSoftComponentsTransforms(
        normalizedSoftComponents,
        overrides.hydrateMapTransform
      )
      : normalizedSoftComponents;

  // Build initial dependency graph
  const initialDependencyGraph = buildReverseDependencyGraph(
    hydratedSoftComponents
  );

  return create<AppStore>()(
    subscribeWithSelector(
      (set, get) => ({
        state: "ready",
        originalHistory: [],
        overrides,
        customFields,
        onActions,
        iframeDocRef,
        showVersionFields: showVersionFields,
        editingComponent: null,
        setShowVersionFields: (show: boolean) => set({ showVersionFields: show }),
        getIframeDoc: () => iframeDocRef.current,
        setIframeDoc: (doc: Document | null) => {
          iframeDocRef.current = doc;

          if (!doc) {
            return;
          }

          const { state, editableComponentIds } = get();

          if (state === "building") {
            setEditVisibility(doc, {
              mode: "build",
              editableIds: editableComponentIds,
            });
            return;
          }

          if (state === "remodeling") {
            setEditVisibility(doc, {
              mode: "remodel",
              editableIds: editableComponentIds,
            });
            return;
          }

          clearEditVisibility(doc);
        },
        storeHistory: (history: History[]) => set({ originalHistory: history }),
        removeHistory: () => set({ originalHistory: [] }),
        itemSelector: null,
        setItemSelector: (selector) => set({ itemSelector: selector }),
        originalItem: null,
        setOriginalItem: (item) => set({ originalItem: item }),
        hydratedSoftComponents,
        softComponents: hydratedSoftComponents,
        dependencyGraph: initialDependencyGraph,
        softConfig: {
          ...hardConfig,
          components: {
            ...hardConfig.components,
            ...buildInitialSoftComponents(
              hardConfig,
              hydratedSoftComponents,
              overrides,
              showVersionFields,
              customFields
            ),
          },
          categories: {
            ...(hardConfig.categories || {}),
          },
        },
        setSoftComponent: (
          name: string,
          version: string,
          component: SoftComponent
        ) => {
          if (hardConfig.components && hardConfig.components[name]) {
            console.warn(`Cannot set soft component "${name}" because it conflicts with a base hardConfig component.`);
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
        setSoftComponents: (incomingComponents: SoftComponents) => {
          const state = get();
          const nextSoftComponents = { ...state.softComponents };
          const nextConfigComponents = { ...state.softConfig.components };

          Object.entries(incomingComponents).forEach(([name, data]) => {
            if (hardConfig.components && hardConfig.components[name]) {
              return; // Skip base components completely
            }

            const existing = nextSoftComponents[name];

            const finalComponentData = existing ? {
              ...existing,
              ...data,
              name: data.name || existing.name || name,
              versions: { ...existing.versions, ...data.versions },
            } : data;

            finalComponentData.name = finalComponentData.name || name;

            nextSoftComponents[name] = finalComponentData;

            const activeVersion = finalComponentData.defaultVersion;
            const activeVersionData = finalComponentData.versions[activeVersion];

            if (activeVersionData) {
              nextConfigComponents[name] = createVersionedComponentConfig(
                name,
                finalComponentData.name || name,
                activeVersion,
                Object.keys(finalComponentData.versions),
                state.softConfig,
                nextSoftComponents,
                activeVersionData.defaultProps,
                state.showVersionFields,
                state.customFields
              );
            }
          });

          set({
            softComponents: nextSoftComponents,
            softConfig: {
              ...state.softConfig,
              components: nextConfigComponents,
            },
          });
        },

        hydrateTransforms: () => {
          const { overrides, softComponents, softConfig } = get();
          if (!overrides?.hydrateMapTransform) return;

          const hydratedComponents = hydrateSoftComponentsTransforms(
            softComponents,
            overrides.hydrateMapTransform
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
                get().customFields
              );
            }
          });

          set({
            softComponents: hydratedComponents,
            softConfig: {
              ...softConfig,
              components: nextConfigComponents
            }
          });
        },
        setSoftComponentDefaultVersion: (name: string, version: string) => {
          const softComponent = get().softComponents[name]?.versions?.[version];
          const allVersions = Object.keys(
            get().softComponents[name]?.versions || {}
          );
          const displayName = get().softComponents[name]?.name || name;

          if (!softComponent) {
            throw new Error(
              `Soft component "${name}" version "${version}" does not exist.`
            );
          }

          const newSoftComponentConfig = createVersionedComponentConfig(
            name,
            displayName,
            version,
            allVersions,
            get().softConfig,
            get().softComponents,
            softComponent.defaultProps,
            get().showVersionFields,
            get().customFields
          );

          set((state) => ({
            softConfig: {
              ...state.softConfig,
              components: {
                ...state.softConfig.components,
                [name]: newSoftComponentConfig,
              },
            },
            softComponents: {
              ...state.softComponents,
              [name]: {
                ...state.softComponents[name],
                defaultVersion: version,
              },
            },
          }));
        },
        removeSoftComponentVersion: (key: string, version: string) => {
          set((state) => {
            const component = state.softComponents[key];
            if (!component) return {};

            // Remove the version
            const newVersions = Object.fromEntries(
              Object.entries(component.versions || {}).filter(
                ([k, _]) => k !== version
              )
            );

            // Determine new defaultVersion
            let newDefaultVersion = component.defaultVersion;
            if (component.defaultVersion === version) {
              const versionKeys = Object.keys(newVersions);
              newDefaultVersion =
                versionKeys.length > 0
                  ? versionKeys[versionKeys.length - 1]
                  : "";
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
        removeSoftComponent: (key: string) => {
          set((state) => ({
            softComponents: Object.fromEntries(
              Object.entries(state.softComponents).filter(([k, _]) => k !== key)
            ),
          }));
        },
        setSoftComponentConfig: (
          key: string,
          config: ComponentConfig,
          category?: string
        ) => {
          set((state) => ({
            softConfig: {
              ...state.softConfig,
              components: {
                ...state.softConfig.components,
                [key]: { ...config },
              },
              categories:
                category
                  ? {
                    ...(state.softConfig.categories || {}),
                    [category]: {
                      ...(state.softConfig.categories?.[category] || {}),
                      components: [
                        ...(state.softConfig.categories?.[category]
                          ?.components || []),
                        key,
                      ],
                    },
                  }
                  : (state.softConfig.categories || {}),
            },
          }));
        },
        removeSoftComponentConfig: (key: string) => {
          set((state) => ({
            softConfig: {
              ...state.softConfig,
              components: Object.fromEntries(
                Object.entries(state.softConfig.components).filter(
                  ([k, _]) => k !== key
                )
              ),
            },
          }));
        },
        setSoftCategoryConfig: (key: string, category) => {
          set((state) => ({
            softConfig: {
              ...state.softConfig,
              categories: {
                ...state.softConfig.categories,
                [key]: {
                  ...state.softConfig.categories?.[key],
                  ...category,
                },
              },
            },
          }));
        },
        removeSoftCategoryConfig: (key: string) => {
          set((state) => ({
            softConfig: {
              ...state.softConfig,
              categories: Object.fromEntries(
                Object.entries(state.softConfig.categories || {}).filter(
                  ([k, _]) => k !== key
                )
              ),
            },
          }));
        },
        builder: createBuildersSlice(set, get, hardConfig),
        editingComponentId: null,
        editableComponentIds: new Set(),
        setEditableComponentIds: (ids) => set({ editableComponentIds: ids }),
        addEditableComponentId: (id) => {
          set((state) => {
            const newIds = new Set(state.editableComponentIds);
            newIds.add(id);
            return { editableComponentIds: newIds };
          });
        },
        clearEditingState: () =>
          set({
            editingComponentId: null,
            editableComponentIds: new Set(),
          }),
        rebuildDependents: (componentName: string, version: string) => {
          const state = get();
          const dependents = state.dependencyGraph.get(componentName) || new Set();

          if (dependents.size === 0) return;

          const config = { ...state.softConfig };
          const softComponents = state.softComponents;

          // Rebuild all dependent components
          const toBuild = Array.from(dependents);

          for (const dependentName of toBuild) {
            const dependent = softComponents[dependentName];
            const defaultVersion =
              dependent.defaultVersion || Object.keys(dependent.versions || {}).pop();

            if (!defaultVersion) continue;

            const versionedComponent = dependent.versions[defaultVersion];
            const allVersions = Object.keys(dependent.versions || {});

            if (!versionedComponent) continue;

            // Rebuild the dependent component config
            const newConfig = createVersionedComponentConfig(
              dependentName,
              dependent.name || dependentName,
              defaultVersion,
              allVersions,
              config,
              softComponents,
              versionedComponent.defaultProps,
              state.showVersionFields,
              state.customFields
            );

            config.components[dependentName] = newConfig;
          }

          set((s) => ({ ...s, softConfig: config }));
        },
      })
    )
  );
};
