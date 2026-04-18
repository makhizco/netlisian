import {
  AppState,
  ComponentConfig,
  Config,
  Data,
  DefaultComponentProps,
  History,
  PuckApi,
  ComponentData,
  walkTree,
} from "@measured/puck";
import { AppStore } from "../";
import { builderConfig } from "../../lib/builder/builder-config";
import { BuilderRootConfig } from "../../types/BuilderConfig";
import { SoftComponent } from "../../types/SoftComponent";
import { softComponentFromAppState } from "../../lib/soft-component-from-appstate";
import { softComponentToAppState } from "../../lib/soft-component-to-appstate";
import { rootDroppableId } from "../../lib/root-droppable-id";
import { createVersionedComponentConfig } from "../../lib/create-versioned-component-config";
import { decomposeSoftComponent } from "../../lib/decompose-soft-component";
import { demolishSoftComponent } from "../../lib/demolish-soft-component";
import { componentNameFromLabel } from "../../lib/component-key";
import { VersionedSoftComponent } from "../../types/SoftComponent";
import { generateId } from "../../lib/generate-id";
import {
  clearEditVisibility,
  setEditVisibility,
} from "../../lib/edit-visibility-utils";

export type CompletedComponentResult = {
  id: string;
  version: string;
  softComponent: VersionedSoftComponent["versions"][string];
};

export type BuildersSlice = {
  /**
   * Build a new soft component based on the selected item in history.
   *
   * Steps:
   * 1. Data Modifications:
   *    - Store History
   *    - Set currently selected item to the root
   * 2. Soft Config Modifications:
   *    - Update root to include: name, fields, fieldSettings, for soft component
   *    - Update each component config to map the soft fields to component fields
   *    - Update each component for slot settings (Dropzone enable/disable)
   */
  build: (
    history: History<AppState>[],
    selectedItem: PuckApi["selectedItem"],
    itemSelector: { index: number; zone?: string } | null,
    puckDispatch: PuckApi["dispatch"],
    name?: string,
  ) => void | null;

  /**
   * Remodel the selected soft component by decomposing it and resetting as root.
   *
   * Steps:
   * 1. Data Modifications:
   *    - Store History
   *    - Decompose and set selected soft component to root
   * 2. Soft Config Modifications:
   *    - Update root with name, fields, fieldSettings for soft component
   *    - Update each component config to map soft fields to component fields
   *    - Update each component for slot settings (Dropzone enable/disable)
   *    - Remove selected component or dependencies to avoid circular dependencies
   */
  remodel: (
    history: History<AppState>[],
    selectedItem: PuckApi["selectedItem"],
    itemSelector: { index: number; zone?: string } | null,
    puckDispatch: PuckApi["dispatch"],
    refreshPermission: () => void,
  ) => void;

  /**
   * Switch to a different version of the soft component being remodeled.
   *
   * Steps:
   * 1. Get the soft component for the selected version
   * 2. Convert it back to AppState format
   * 3. Update the puck data with the new version's content
   */
  setVersion: (
    componentName: string,
    newVersion: string,
    currentProps: Record<string, any>,
    puckDispatch: PuckApi["dispatch"],
  ) => void;
  /**
   * Mark the current build/remodel as complete.
   *
   * Steps:
   * 1. Config Modifications:
   *    - Compose the build settings into soft component
   *    - Set the component to the config
   *    - Restore permissions, resolve fields and resolve data of all components
   * 2. Data Modifications:
   *    - Transform the last item of history to replace the source components into composed soft component
   *    - Strip the build settings fields
   *    - Apply modified history to puck data.
   */
  complete: (
    appState: AppState<any>,
    setHistories: PuckApi["history"]["setHistories"],
    getItemBySelector: PuckApi["getItemBySelector"],
  ) => CompletedComponentResult;

  demolish: (
    componentName: string,
    data: AppState["data"],
    puckDispatch: PuckApi["dispatch"],
  ) => void;

  inspect: (componentName: string, puckDispatch: PuckApi["dispatch"]) => void;

  /**
   * Mark the current build/remodel as complete.
   *
   * Steps:
   * 1. Config Modifications:
   *    - Restore permissions, resolve fields and resolve data of all components
   * 2. Data Modifications:
   *    - Restore history to puck data.
   */
  cancel: (setHistories: PuckApi["history"]["setHistories"]) => void;

  /** Compose multiple components into a soft component.
   * 1. SoftComponent: Get soft fields + default values from the appState.root + sub-component maps + fixedProps
   */
  compose: (
    appState: AppState,
    componentName: string,
    editedItem: ComponentData,
    displayName: string,
    category?: string,
  ) => [ComponentConfig, string] | undefined;

  /** Break down a composed component into its parts.
   * 1. Get softComponentProps
   * 2. Create a virtual component with all the props from soft-component.
   * 3. Replace the softComponent with hardComponent
   */
  decompose: (componentData: ComponentData) => ComponentData[];
};

export const createBuildersSlice = (
  set: (
    partial:
      | AppStore
      | Partial<AppStore>
      | ((state: AppStore) => AppStore | Partial<AppStore>),
    replace?: false,
  ) => void,
  get: () => AppStore,
  initialConfig: Config,
): BuildersSlice => ({
  build: (history, selectedItem, itemSelector, puckDispatch, name) => {
    if (!selectedItem || !itemSelector) {
      throw new Error("No item selected to build from.");
    }

    puckDispatch({
      type: "set",
      state: (previous) => ({
        ui: {
          ...previous.ui,
          itemSelector: null,
        },
        data: {
          ...previous.data,
          root: {
            ...previous.data.root,
            props: {
              ...previous.data.root?.props,
              _name: name || "New Soft Component",
            },
          } as Data["root"],
          // content: [{ ...selectedItem }],
        },
      }),
    });

    const config = { ...get().softConfig };
    const overrides = get().overrides;
    const buildConfig = builderConfig(
      config,
      overrides,
      undefined,
      get().showVersionFields,
      undefined,
      get().customFields,
    );

    // Building editable ids
    const editableIds = new Set<string>([selectedItem.props.id]);
    const initialContent = [{ ...selectedItem }];

    walkTree(
      {
        root: {},
        content: initialContent,
      },
      { components: config.components },
      (components) => {
        components.forEach((comp) => {
          editableIds.add(comp.props.id);
        });
        return components;
      },
    );

    // If iframe doc is set, apply edit visibility
    requestAnimationFrame(() =>
      setEditVisibility(get().iframeDoc, {
        mode: "build",
        editableIds: editableIds,
      }),
    );

    set((s) => ({
      ...s,
      softConfig: buildConfig,
      storedConfig: config,
      originalHistory: history,
      itemSelector: {
        index: itemSelector.index,
        zone: itemSelector.zone || rootDroppableId,
      },
      editingComponentId: selectedItem.props.id,
      editableComponentIds: editableIds,
      state: "building",
    }));

    // TODO: Hack to rerender root
    requestAnimationFrame(() =>
      puckDispatch({
        type: "replaceRoot",
        root: {
          title: "Soft Component Builder",
          _name: name || "New Soft Component",
        },
      } as any),
    );
  },
  remodel: (history, selectedItem, itemSelector, puckDispatch) => {
    if (!selectedItem || !itemSelector) {
      throw new Error("No item selected to build from.");
    }

    const softComponentName = selectedItem.type;

    if (!softComponentName) {
      throw new Error("Selected item must have a valid component type.");
    }

    const softComponentVersion =
      (selectedItem.props as DefaultComponentProps)?.version || "1.0.0";

    // Get soft component from store
    const softComponent =
      get().softComponents[softComponentName]?.versions[softComponentVersion];
    const softComponentMeta = get().softComponents[softComponentName];

    const versions = Object.keys(
      get().softComponents[softComponentName].versions || {},
    );

    if (!softComponent) {
      throw new Error(
        `Soft component "${softComponentName}" with version "${softComponentVersion}" not found.`,
      );
    }

    puckDispatch({
      type: "setUi",
      ui: (previous) => ({
        ...previous,
        itemSelector: undefined,
      }),
    });

    // Convert soft component back to AppState format for remodeling (decomposition)
    const { root, content } = softComponentToAppState(
      softComponent,
      softComponentName,
      softComponentVersion,
      versions,
      selectedItem.props,
      get().softConfig.components,
      get().overrides,
      softComponentMeta?.name || softComponentName,
      softComponentMeta?.category,
      get().customFields,
    );

    const config = { ...get().softConfig };
    const overrides = get().overrides;
    // const getStore = () => get();
    // const getEditableIds = () => getStore().editableComponentIds;

    // Get dependent components from the reverse dependency graph
    const dependents =
      get().dependencyGraph.get(softComponentName) || new Set<string>();

    const buildConfig = builderConfig(
      config,
      overrides,
      softComponentName,
      get().showVersionFields,
      dependents,
      get().customFields,
    );

    // Collect all descendant IDs in edit scope using walkTree
    const editableIds = new Set<string>([]);
    const decomposedComponents = get().builder.decompose(selectedItem);

    // These will become stale when component is decomposed we need the decomposed ids rather than soft component id
    walkTree(
      { root: {}, content: decomposedComponents || [] },
      { components: config.components },
      (components) => {
        components.forEach((comp) => {
          editableIds.add(comp.props.id);
        });
        return components;
      },
    );

    // Remove the component at current position
    // puckDispatch({
    //   type: "remove",
    //   index: itemSelector.index,
    //   zone: itemSelector.zone || rootDroppableId,
    // });

    // Insert decomposed content at the same position
    // content.forEach((componentData, index) => {
    //   puckDispatch({
    //     type: "insert",
    //     componentType: componentData.type,
    //     destinationIndex: itemSelector.index + index,
    //     destinationZone: itemSelector.zone || rootDroppableId,
    //     id: componentData.props.id,
    //   });
    // });

    // refreshPermissions()

    puckDispatch({
      type: "setData",
      data: (prevData) => ({
        root: { ...root, _versions: versions } as any,
        content: walkTree({ ...prevData }, { ...config }, (components) => {
          const next = components.map((component) => ({
            ...component,
            props: { ...component.props },
          }));

          const index = next.findIndex(
            (component) => component.props.id === selectedItem.props.id,
          );

          if (index !== -1) {
            next.splice(
              index,
              1,
              ...decomposedComponents.map((component) => ({
                ...component,
                props: { ...component.props },
              })),
            );
          }

          return next;
        }).content,
      }),
    });

    requestAnimationFrame(() =>
      setEditVisibility(get().iframeDoc, {
        mode: "remodel",
        editableIds: editableIds,
      }),
    );

    set((s) => ({
      ...s,
      storedConfig: config,
      softConfig: buildConfig,
      originalHistory: history,
      itemSelector: {
        index: itemSelector.index,
        zone: itemSelector.zone || rootDroppableId,
      },
      editingComponentId: selectedItem.props.id,
      editingComponent: softComponentName,
      editableComponentIds: editableIds,
      state: "remodeling",
    }));

    requestAnimationFrame(() =>
      puckDispatch({
        type: "replaceRoot",
        root: {
          title: (root.props as any).title,
          _name: (root.props as any)._name,
          _category: (root.props as any)._category,
        },
      } as any),
    );
  },
  complete: (appState, setHistories, getItemBySelector) => {
    if (get().state === "ready") {
      throw new Error("Not building or remodeling a component.");
    }

    const displayName = (
      appState.data.root?.props as {
        _name?: string;
      }
    )?._name?.trim();

    // Handle existing name for remodelling
    if (!displayName) {
      throw new Error("Root component must have a name to compose.");
    }

    const itemSelector = get().itemSelector;

    if (!itemSelector) {
      throw new Error("No item selector found for completed component.");
    }

    // Get item selector
    // Get the item being edited
    const selectedItem = getItemBySelector(itemSelector);

    if (!selectedItem) {
      throw new Error("Cannot find item being edited");
    }

    const rootCategory = (
      appState.data.root?.props as {
        _category?: string;
      }
    )?._category;

    const rootProps = appState.data.root?.props as BuilderRootConfig;

    const componentName = componentNameFromLabel(displayName, get().overrides, {
      ...(rootProps || {}),
      existingKeys: Object.keys(get().softComponents),
      state: get().state,
    });

    if (!componentName) {
      throw new Error("Failed to generate component key from name.");
    }

    const [defaultSoftComponentConfig, version] =
      get().builder.compose(
        appState,
        componentName,
        selectedItem,
        displayName,
        rootCategory,
      ) || [];

    if (!defaultSoftComponentConfig) {
      throw new Error("Failed to compose new soft component config.");
    }

    const storedHistories = get().originalHistory;
    setHistories([...storedHistories]);

    const config = { ...(get().softConfig || initialConfig) };

    const mapComponentConfig = get().overrides.mapComponentConfig;

    const newSoftComponentConfig: ComponentConfig = mapComponentConfig
      ? mapComponentConfig(componentName, defaultSoftComponentConfig, rootProps)
      : defaultSoftComponentConfig;

    set((s) => {
      const nextComponents = {
        ...Object.entries(config.components).reduce(
          (acc, [name, component]) => {
            let tempComponent: ComponentConfig | undefined =
              config.components?.[name];
            if (tempComponent) {
              acc[name] = tempComponent;
              acc[name].render = tempComponent.render;
            } else {
              tempComponent = { ...component };
              delete tempComponent?.resolvePermissions;
              delete tempComponent?.resolveData;
              acc[name] = tempComponent;
            }
            return acc;
          },
          {} as Config["components"],
        ),
        [componentName]: { ...newSoftComponentConfig },
      };

      const categories = get().softConfig.categories || {};

      const nextCategories = rootCategory
        ? {
            ...categories,
            [rootCategory]: {
              ...(categories[rootCategory] || {}),
              title: categories[rootCategory]?.title || rootCategory,
              components: Array.from(
                new Set([
                  ...(categories[rootCategory]?.components || []),
                  componentName,
                ]),
              ),
            },
          }
        : categories;

      return {
        ...s,
        softConfig: {
          ...config,
          root: {
            ...initialConfig.root,
          },
          components: nextComponents,
          categories: nextCategories,
        },
        storedConfig: undefined,
        state: "inspecting",
        originalHistory: [],
      };
    });

    if (!version) {
      throw new Error("Failed to resolve completed component version.");
    }

    const completedSoftComponent =
      get().softComponents[componentName]?.versions[version];

    if (!completedSoftComponent) {
      throw new Error(
        `Completed soft component \"${componentName}\" version \"${version}\" not found.`,
      );
    }

    // Rebuild all dependent components after successfully completing the component
    get().rebuildDependents(componentName, version);

    return {
      id: componentName,
      version,
      softComponent: completedSoftComponent,
    };
  },
  inspect: (componentName, puckDispatch) => {
    if (get().state !== "inspecting") {
      throw new Error("Not in inspecting state.");
    }

    const selector = { ...get().itemSelector };

    if (selector?.index === undefined || !selector?.zone) {
      throw new Error("No selector found for last item.");
    }

    const editableComponentId = get().editingComponentId;

    requestAnimationFrame(() => {
      const config = get().softConfig;
      const newComponent = config.components[componentName];

      const reconstructedTree = (data: Data) =>
        walkTree(data, config, (components) => {
          return components.map((comp) => {
            if (comp.props.id === editableComponentId) {
              // Replace with new component
              return {
                type: componentName,
                props: {
                  ...newComponent.defaultProps,
                  id: generateId(componentName),
                },
              } as ComponentData;
            }
            return comp;
          });
        });

      puckDispatch({
        type: "setData",
        data: (data) => {
          return reconstructedTree(data);
        },
      });
    });

    requestAnimationFrame(() => clearEditVisibility(get().iframeDoc));

    set((s) => ({
      ...s,
      state: "ready",
      setItemSelector: undefined,
      setOriginalItem: undefined,
      editingComponent: null,
      editingComponentId: null,
      editableComponentIds: new Set(),
    }));
  },
  cancel: (setHistories) => {
    const storedHistories = get().originalHistory;
    requestAnimationFrame(() => setHistories([...storedHistories]));

    requestAnimationFrame(() => clearEditVisibility(get().iframeDoc));

    set((s) => ({
      ...s,
      softConfig: get().storedConfig || initialConfig,
      storedConfig: undefined,
      originalHistory: [],
      itemSelector: null,
      originalItem: null,
      state: "ready",
      editingComponent: null,
      editingComponentId: null,
      editableComponentIds: new Set(),
    }));
  },
  compose: (appState, componentName, editedItem, displayName, category) => {
    if (!componentName) {
      throw new Error("Root component must have a name to compose.");
    }

    const componentConfigs = get().softConfig.components;

    if (
      get().state === "building" &&
      Object.keys(componentConfigs).includes(componentName)
    ) {
      throw new Error(
        `Component name "${componentName}" already exists in the configuration.`,
      );
    }

    const [softComponent, version]: [SoftComponent, string] =
      softComponentFromAppState(
        appState,
        componentConfigs,
        editedItem,
        {
          name: displayName,
          category,
        },
        get().customFields,
      );

    // Get all versions and the default version of this component
    const existingComponent = get().softComponents[componentName];
    const allVersions = Object.keys(existingComponent?.versions || {});
    const isNewVersion = !allVersions.includes(version);

    const newSoftComponentConfig = createVersionedComponentConfig(
      componentName,
      displayName,
      version,
      isNewVersion ? [...allVersions, version] : allVersions,
      get().softConfig,
      {
        ...get().softComponents,
        [componentName]: {
          ...existingComponent,
          versions: {
            ...existingComponent?.versions,
            [version]: softComponent,
          },
        },
      },
      softComponent.defaultProps,
      get().showVersionFields,
      get().customFields,
    );

    get().setSoftComponent(componentName, version, softComponent);

    return [newSoftComponentConfig, version];
  },
  decompose: (componentData) => {
    if (!componentData?.type || !componentData?.props.id) {
      throw new Error("Component data must have type and id to decompose.");
    }

    return decomposeSoftComponent(componentData, get().softComponents);
  },
  demolish: (componentName, data, puckDispatch) => {
    if (get().state !== "ready") {
      throw new Error("Components can only be demolished in ready state.");
    }

    const result = demolishSoftComponent(
      componentName,
      data,
      get().softConfig,
      get().softComponents,
    );

    puckDispatch({
      type: "setData",
      data: result.data,
    });

    // Update store with new config and soft components
    set((s) => ({
      ...s,
      softComponents: result.softComponents,
      softConfig: result.config,
    }));
  },
  setVersion: (componentName, newVersion, currentProps, puckDispatch) => {
    if (get().state !== "remodeling") {
      throw new Error("Can only switch versions during remodeling.");
    }

    const softComponent =
      get().softComponents[componentName]?.versions[newVersion];
    const softComponentMeta = get().softComponents[componentName];

    if (!softComponent) {
      throw new Error(
        `Soft component "${componentName}" with version "${newVersion}" not found.`,
      );
    }

    const versions = Object.keys(
      get().softComponents[componentName].versions || {},
    );

    // Convert soft component to AppState format
    const { root, content } = softComponentToAppState(
      softComponent,
      componentName,
      newVersion,
      versions,
      currentProps,
      get().softConfig.components,
      get().overrides,
      softComponentMeta?.name || componentName,
      softComponentMeta?.category,
      get().customFields,
    );

    // Update puck data with new version
    puckDispatch({
      type: "setData",
      data: (previous) => ({
        ...previous,
        root: { ...root, props: { ...root.props, _versions: versions } },
        content: content || [],
      }),
    });
  },
});
