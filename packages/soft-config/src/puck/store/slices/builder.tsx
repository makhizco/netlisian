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
  createUsePuck,
} from "@measured/puck";
import { AppStore } from "../";
import { builderConfig } from "../../lib/builder/builder-config";
import { SoftComponent } from "../../types/SoftComponent";
import { softComponentFromAppState } from "../../lib/soft-component-from-appstate";
import { softComponentToAppState } from "../../lib/soft-component-to-appstate";
import { rootDroppableId } from "../../lib/root-droppable-id";
import { createVersionedComponentConfig } from "../../lib/create-versioned-component-config";
import { decomposeSoftComponent } from "../../lib/decompose-soft-component";
import { demolishSoftComponent } from "../../lib/demolish-soft-component";

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
    puckDispatch: PuckApi["dispatch"]
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
    puckDispatch: PuckApi["dispatch"]
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
    puckDispatch: PuckApi["dispatch"]
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
    setHistories: PuckApi["history"]["setHistories"]
  ) => string;

  demolish: (
    componentName: string,
    data: AppState["data"],
    puckDispatch: PuckApi["dispatch"]
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
    componentName: string
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
    replace?: false
  ) => void,
  get: () => AppStore,
  initialConfig: Config
): BuildersSlice => ({
  build: (history, selectedItem, itemSelector, puckDispatch) => {
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
            props: {
              _name: "New Soft Component",
            },
          } as Data["root"],
          content: [{ ...selectedItem }],
        },
      }),
    });

    const config = { ...get().softConfig };
    const overrides = get().overrides;
    const buildConfig = builderConfig(config, overrides);

    set((s) => ({
      ...s,
      softConfig: buildConfig,
      storedConfig: config,
      originalHistory: history,
      itemSelector: {
        index: itemSelector.index,
        zone: itemSelector.zone || rootDroppableId,
      },
      state: "building",
    }));

    // TODO: Hack to rerender root
    setTimeout(
      () =>
        puckDispatch({
          type: "replaceRoot",
          root: {
            title: "Soft Component Builder",
            _name: "New Soft Component",
          },
        } as any),
      100
    );
  },
  remodel: (history, selectedItem, itemSelector, puckDispatch) => {
    if (!selectedItem || !itemSelector) {
      throw new Error("No item selected to build from.");
    }

    // Get the component name
    const softComponentName = selectedItem.type;

    if (!softComponentName) {
      throw new Error("Selected item must have a valid component type.");
    }

    // Get version from props or default to "1.0.0"
    const softComponentVersion =
      (selectedItem.props as DefaultComponentProps)?.version || "1.0.0";

    // Get soft component from store
    const softComponent =
      get().softComponents[softComponentName]?.versions[softComponentVersion];

    const versions = Object.keys(
      get().softComponents[softComponentName].versions || {}
    );

    if (!softComponent) {
      throw new Error(
        `Soft component "${softComponentName}" with version "${softComponentVersion}" not found.`
      );
    }

    puckDispatch({
      type: "setUi",
      ui: (previous) => ({
        ...previous,
        itemSelector: undefined,
      }),
    });

    // Convert soft component back to AppState format for remodeling
    const { root, content } = softComponentToAppState(
      softComponent,
      softComponentName,
      softComponentVersion,
      versions,
      selectedItem.props,
      get().softConfig.components
    );

    puckDispatch({
      type: "setData",
      data: (previous) => ({
        ...previous,
        root: { ...root, _versions: versions },
        content: content || [],
      }),
    });

    const config = { ...get().softConfig };
    const overrides = get().overrides;
    const buildConfig = builderConfig(config, overrides, softComponentName);

    set((s) => ({
      ...s,
      storedConfig: config,
      softConfig: buildConfig,
      originalHistory: history,
      itemSelector: {
        index: itemSelector.index,
        zone: itemSelector.zone || rootDroppableId,
      },
      state: "remodeling",
    }));

    setTimeout(
      () =>
        puckDispatch({
          type: "replaceRoot",
          root: {
            title: "Soft Component Builder",
            _name: "New Soft Component",
          },
        } as any),
      100
    );
  },
  complete: (appState, setHistories) => {
    if (get().state === "ready") {
      throw new Error("Not building or remodeling a component.");
    }

    const componentName = (
      appState.data.root?.props as {
        _name?: string;
      }
    )?._name;

    // Handle existing name for remodelling
    if (!componentName) {
      throw new Error("Root component must have a name to compose.");
    }

    const [newSoftComponentConfig, version] =
      get().builder.compose(appState, componentName) || [];

    if (!newSoftComponentConfig) {
      throw new Error("Failed to compose new soft component config.");
    }

    const storedHistories = get().originalHistory;
    setHistories([...storedHistories]);

    const config = { ...(get().softConfig || initialConfig) };

    set((s) => ({
      ...s,
      softConfig: {
        ...config,
        root: {
          ...initialConfig.root, // TODO: Add support for dynamic root props in future maybe
        },
        components: {
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
            {} as Config["components"]
          ),
          [componentName]: { ...newSoftComponentConfig },
        },
      },
      storedConfig: undefined,
      state: "inspecting",
      originalHistory: [],
    }));

    return componentName;
  },
  inspect: (componentName, puckDispatch) => {
    if (get().state !== "inspecting") {
      throw new Error("Not in inspecting state.");
    }

    const selector = { ...get().itemSelector };

    if (selector?.index === undefined || !selector?.zone) {
      throw new Error("No selector found for last item.");
    }

    setTimeout(() => {
      puckDispatch({
        type: "remove",
        index: selector.index!,
        zone: selector.zone!,
      });
      puckDispatch({
        type: "insert",
        destinationIndex: selector.index!,
        destinationZone: selector.zone!,
        componentType: componentName,
      });
    }, 500);

    set((s) => ({
      ...s,
      state: "ready",
      setItemSelector: undefined,
      setOriginalItem: undefined,
    }));
  },
  cancel: (setHistories) => {
    const storedHistories = get().originalHistory;
    setTimeout(() => setHistories([...storedHistories]), 100);

    set((s) => ({
      ...s,
      softConfig: get().storedConfig || initialConfig,
      storedConfig: undefined,
      originalHistory: [],
      itemSelector: null,
      originalItem: null,
      state: "ready",
    }));
  },
  compose: (appState, componentName) => {
    if (!componentName) {
      throw new Error("Root component must have a name to compose.");
    }

    const componentConfigs = get().softConfig.components;

    if (
      get().state === "building" &&
      Object.keys(componentConfigs).includes(componentName)
    ) {
      throw new Error(
        `Component name "${componentName}" already exists in the configuration.`
      );
    }

    const [softComponent, version]: [SoftComponent, string] =
      softComponentFromAppState(appState, componentConfigs);

    // Get all versions and the default version of this component
    const existingComponent = get().softComponents[componentName];
    const allVersions = Object.keys(existingComponent?.versions || {});
    const isNewVersion = !allVersions.includes(version);

    const newSoftComponentConfig = createVersionedComponentConfig(
      componentName,
      version,
      isNewVersion ? [...allVersions, version] : allVersions,
      get().softConfig,
      {...get().softComponents,
        [componentName]: {
          ...existingComponent,
          versions: {
            ...existingComponent?.versions,
            [version]: softComponent,
          },
        },
      },
      softComponent.defaultProps
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
      get().softComponents
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

    if (!softComponent) {
      throw new Error(
        `Soft component "${componentName}" with version "${newVersion}" not found.`
      );
    }

    const versions = Object.keys(
      get().softComponents[componentName].versions || {}
    );

    // Convert soft component to AppState format
    const { root, content } = softComponentToAppState(
      softComponent,
      componentName,
      newVersion,
      versions,
      currentProps,
      get().softConfig.components
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
