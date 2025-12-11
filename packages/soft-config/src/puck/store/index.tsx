import { create, StoreApi } from "zustand";
import { subscribeWithSelector, devtools } from "zustand/middleware";
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
} from "../lib/build-initial-soft-components";
import { Overrides } from "../types/Overrides";

type Status = "building" | "remodeling" | "ready" | "inspecting";

export type AppStore = {
  softConfig: Config;
  softComponents: SoftComponents;
  hydratedSoftComponents?: SoftComponents;
  state: Status;
  originalHistory: History[];
  storedConfig?: Config;
  overrides: Overrides;
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
  setSoftComponentDefaultVersion: (key: string, version: string) => void;
  removeSoftComponent: (key: string) => void;
};

export type AppStoreApi = StoreApi<AppStore>;

export const createSoftConfigStore = (
  hardConfig: Config = {
    components: {},
  },
  softComponents: SoftComponents = {},
  overrides: Overrides = {}
) => {
  const hydratedSoftComponents =
    overrides?.hydrateMapTransform
      ? hydrateSoftComponentsTransforms(
        softComponents,
        overrides.hydrateMapTransform
      )
      : softComponents;

  return create<AppStore>()(
    subscribeWithSelector(
      devtools((set, get) => ({
        state: "ready",
        originalHistory: [],
        overrides,
        storeHistory: (history: History[]) => set({ originalHistory: history }),
        removeHistory: () => set({ originalHistory: [] }),
        itemSelector: null,
        setItemSelector: (selector) => set({ itemSelector: selector }),
        originalItem: null,
        setOriginalItem: (item) => set({ originalItem: item }),
        hydratedSoftComponents,
        softComponents: hydratedSoftComponents,
        softConfig: {
          ...hardConfig,
          components: {
            ...hardConfig.components,
            ...buildInitialSoftComponents(
              hardConfig,
              hydratedSoftComponents,
              overrides
            ),
          },
        },
        setSoftComponent: (
          name: string,
          version: string,
          component: SoftComponent
        ) => {
          set((state) => ({
            softComponents: {
              ...state.softComponents,
              [name]: {
                defaultVersion: version,
                versions: {
                  ...(state.softComponents[name]?.versions || {}),
                  [version]: component,
                },
              },
            },
          }));
        },
        setSoftComponentDefaultVersion: (name: string, version: string) => {
          const softComponent = get().softComponents[name]?.versions?.[version];
          const allVersions = Object.keys(
            get().softComponents[name]?.versions || {}
          );

          if (!softComponent) {
            throw new Error(
              `Soft component "${name}" version "${version}" does not exist.`
            );
          }

          const newSoftComponentConfig = createVersionedComponentConfig(
            name,
            version,
            allVersions,
            get().softConfig,
            get().softComponents,
            softComponent.defaultProps
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
                category && state.softConfig.categories
                  ? {
                    ...state.softConfig.categories,
                    [category]: {
                      ...state.softConfig.categories[category],
                      components: [
                        ...(state.softConfig.categories[category]
                          ?.components || []),
                        key,
                      ],
                    },
                  }
                  : state.softConfig.categories,
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
      }))
    )
  );
};
