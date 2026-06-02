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
  /**
   * The generated unique registry key/identifier of the completed soft component.
   */
  id: string;

  /**
   * The resolved semantic version string of the completed soft component version.
   */
  version: string;

  /**
   * The compiled underlying JSON definition representing the soft component structure.
   */
  softComponent: VersionedSoftComponent["versions"][string];
};

export type BuildersSlice = {
  /**
   * Initializes the "build" mode to package standard component tree elements into a
   * brand-new, unified, and reusable soft component.
   *
   * @param history - The current Puck workspace history timeline stack. Used to store
   *                  the undo/redo states so they can be restored if the session is canceled.
   * @param selectedItem - The component instance selected in the workspace that will
   *                       serve as the seed/root of the building sandbox.
   * @param itemSelector - Placement and index metadata of the selected item in the editor.
   * @param puckDispatch - The Puck API dispatch function to apply state modifications.
   * @param name - Optional initial user-facing label/display name for the new soft component.
   *
   * @throws {Error} If no item is selected or the item selector is null.
   *
   * Lifecycle & Side Effects:
   * 1. Clones and caches the current core soft configuration and history to the store.
   * 2. Scans the workspace sub-tree to collect all descendent element IDs.
   * 3. Schedules edit visibility highlights to visual-lock edits within the builder boundaries.
   * 4. Transitions the builder workflow state to "building".
   */
  build: (
    history: History<AppState>[],
    selectedItem: PuckApi["selectedItem"],
    itemSelector: { index: number; zone?: string } | null,
    puckDispatch: PuckApi["dispatch"],
    name?: string,
  ) => void | null;

  /**
   * Enters "remodel" mode for an existing soft component, decomposing its compiled structure back
   * into constituent discrete components inside the builder workspace.
   *
   * @param history - The current Puck history list to cache for later restoration.
   * @param selectedItem - The compiled soft component instance selected in the editor.
   * @param itemSelector - Workspace index and droppable zone metadata of the selected component.
   * @param puckDispatch - The Puck API dispatch function.
   * @param refreshPermission - Callback function to refresh access permissions (currently unused).
   *
   * @throws {Error} If the selection parameters are missing, or if the target soft component
   *                 definition cannot be resolved from the cache.
   *
   * Lifecycle & Side Effects:
   * 1. Fetches the soft component version schema from the Zustand store.
   * 2. Evaluates the reverse dependency graph to identify components depending on this soft component.
   *    This locks editing on dependent elements to avoid creating circular dependencies.
   * 3. Explodes the soft component into its constituent raw components in-place within the document data.
   * 4. Updates visual iframe overlays to confine editing to the decomposed sub-tree.
   * 5. Transitions the builder workspace state to "remodeling".
   */
  remodel: (
    history: History<AppState>[],
    selectedItem: PuckApi["selectedItem"],
    itemSelector: { index: number; zone?: string } | null,
    puckDispatch: PuckApi["dispatch"],
    refreshPermission: () => void,
  ) => void;

  /**
   * Switches the active soft component inside the remodeling session to a different
   * registered semantic version.
   *
   * @param componentName - The unique registry key of the soft component.
   * @param newVersion - The target version to activate.
   * @param currentProps - The current top-level properties configured for this element instance.
   * @param puckDispatch - The Puck API dispatch function.
   *
   * @throws {Error} If the store is not currently in the 'remodeling' state, or if the
   *                 requested version is missing.
   *
   * Lifecycle & Side Effects:
   * 1. Resolves the target version's raw layout structure from the store.
   * 2. Re-runs soft component-to-AppState conversions for the target version.
   * 3. Replaces the active remodeling workspace content in-place with the selected version's elements.
   */
  setVersion: (
    componentName: string,
    newVersion: string,
    currentProps: Record<string, any>,
    puckDispatch: PuckApi["dispatch"],
  ) => void;

  /**
   * Finalizes the current build or remodel session, packaging all active workspace components
   * into a compiled, versioned, reusable soft component configuration.
   *
   * @param appState - The current state of the builder editor workspace containing the composed elements.
   * @param setHistories - Puck API callback to restore the original builder history timeline.
   * @param getItemBySelector - Puck API utility to resolve a workspace item using its selector.
   * @returns An object containing the generated component ID, version, and compiled soft component structure.
   *
   * @throws {Error} If the store is not in building/remodeling state, the root component is unnamed,
   *                 or if the selected item cannot be resolved in the workspace.
   *
   * Lifecycle & Side Effects:
   * 1. Converts display labels into safe, unique PascalCase configuration registration keys.
   * 2. Packages workspace child items into a JSON-serializable versioned schema.
   * 3. Re-registers the component with the core configuration components registry.
   * 4. Categorizes the component within layout groups.
   * 5. Restores original history timelines and transitions store state to "inspecting".
   * 6. Rebuilds all other registered soft components that depend on this updated component.
   */
  complete: (
    appState: AppState<any>,
    setHistories: PuckApi["history"]["setHistories"],
    getItemBySelector: PuckApi["getItemBySelector"],
  ) => CompletedComponentResult;

  /**
   * Permanently deletes a soft component registration and purges all of its active
   * occurrences/instances from the active workspace document data.
   *
   * @param componentName - The unique registry name of the soft component to delete.
   * @param data - The active workspace document data to scan and clean.
   * @param puckDispatch - The Puck API dispatch function to apply document cleanups.
   *
   * @throws {Error} If the store is not currently in the stable 'ready' state.
   */
  demolish: (
    componentName: string,
    data: AppState["data"],
    puckDispatch: PuckApi["dispatch"],
  ) => void;

  /**
   * Concludes the inspection workflow, replacing the temporary seed item within the
   * editor workspace document with the newly compiled soft component instance.
   *
   * @param componentName - The final compiled component registry name.
   * @param puckDispatch - The Puck API dispatch function.
   *
   * @throws {Error} If the store is not currently in the 'inspecting' state.
   *
   * Lifecycle & Side Effects:
   * 1. Walk the workspace tree to locate the temporary component being built/remodeled.
   * 2. Replace it with the compiled component type and default versioned props.
   * 3. Flushes layout restriction overlays on the iframe.
   * 4. Resets active builder metadata and transitions state back to "ready".
   */
  inspect: (componentName: string, puckDispatch: PuckApi["dispatch"]) => void;

  /**
   * Discards all modifications made during the current build or remodel session,
   * reverting the editor config, workspace elements, and histories back to their original state.
   *
   * @param setHistories - Puck API callback to restore the original history list.
   *
   * Lifecycle & Side Effects:
   * 1. Transitions store state to "cancelling" to suppress conflicting updates.
   * 2. Re-applies the original workspace config and timeline histories.
   * 3. Clears visual iframe constraints and resets active builder metadata back to normal.
   */
  cancel: (setHistories: PuckApi["history"]["setHistories"]) => void;

  /**
   * Internal compiler hook that converts builder editor workspace states (root props, children)
   * into a unified `SoftComponent` schema and creates a versioned config.
   *
   * @param appState - The current builder editor state.
   * @param componentName - The unique registry key for the soft component.
   * @param editedItem - The original seed component that initiated the build session.
   * @param displayName - The user-facing display name of the soft component.
   * @param category - Optional layout category placement inside the component toolbox.
   * @returns A tuple containing the `ComponentConfig` and its resolved version string, or undefined if failed.
   *
   * @throws {Error} If the component name is empty or collides with existing configs during a new build.
   */
  compose: (
    appState: AppState,
    componentName: string,
    editedItem: ComponentData,
    displayName: string,
    category?: string,
  ) => [ComponentConfig, string] | undefined;

  /**
   * Utility to break down a composed soft component's props and children back into
   * their discrete, uncompiled constituent elements.
   *
   * @param componentData - The compiled component data instance.
   * @returns An array of unpacked standard child component data objects.
   *
   * @throws {Error} If the input component data lacks type or ID.
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
    // 1. Initial validations before launching builder session
    if (!selectedItem || !itemSelector) {
      throw new Error("No item selected to build from.");
    }

    // 2. Cache current configuration to allow structural revert on cancellation
    const config = { ...get().softConfig };
    const overrides = get().overrides;

    // 3. Generate a temporary builder configuration targeting only the building sandbox constraints
    const buildConfig = builderConfig(
      config,
      overrides,
      undefined,
      get().showVersionFields,
      undefined,
      get().customFields,
    );

    // 4. Track sub-tree component IDs to lock down edits.
    // Only the seed component and its nested children are allowed to be modified.
    const editableIds = new Set<string>([selectedItem.props.id]);
    const initialContent = [{ ...selectedItem }];

    // Traverse the child component hierarchy to capture all nested descendant IDs
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

    // 5. Apply iframe visual restrictions.
    // We defer using requestAnimationFrame to ensure the editor has rendered the new layout frames.
    requestAnimationFrame(() =>
      setEditVisibility(get().iframeDoc, {
        mode: "build",
        editableIds: editableIds,
      }),
    );

    // 6. Transition workspace states and store builder tracking metadata in Zustand
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

    // 7. Update Puck's workspace document: reset visual item selectors and designate temporary root name
    requestAnimationFrame(() =>
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
          },
        }),
      }),
    );
  },

  remodel: (history, selectedItem, itemSelector, puckDispatch) => {
    // 1. Initial parameter validations
    if (!selectedItem || !itemSelector) {
      throw new Error("No item selected to build from.");
    }

    const softComponentName = selectedItem.type;

    if (!softComponentName) {
      throw new Error("Selected item must have a valid component type.");
    }

    const softComponentVersion =
      (selectedItem.props as DefaultComponentProps)?.version || "1.0.0";

    // 2. Fetch target soft component and its version metadata from the Zustand store
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

    // 3. Convert the compiled soft component schema back to discrete elements
    // to allow layout and structural editing in the workspace
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

    // 4. Query reverse dependency graph.
    // This allows builders to insulate editing and prevent creating circular dependencies.
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

    // 5. Track element edit scopes during the remodeling session.
    // The soft component itself will be replaced with its decomposed children.
    const editableIds = new Set<string>([]);
    const decomposedComponents = get().builder.decompose(selectedItem);

    // Scan decomposed constituent components to include their IDs in the active editing scope
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

    // 6. Splice-replace the compiled soft component in-place inside workspace document data
    requestAnimationFrame(() => {
      puckDispatch({
        type: "set",
        state: (previous) => ({
          data: {
            root: { ...root, _versions: versions } as any,
            content: walkTree(
              { ...previous.data },
              { ...config },
              (components) => {
                const next = components.map((component) => ({
                  ...component,
                  props: { ...component.props },
                }));

                const index = next.findIndex(
                  (component) => component.props.id === selectedItem.props.id,
                );

                if (index !== -1) {
                  // Replace the single soft component with all decomposed elements
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
              },
            ).content,
          },
          ui: {
            ...previous.ui,
            itemSelector: null,
          },
        }),
      });

      // Update iframe layout boundaries to emphasize only the editable sub-tree elements
      setEditVisibility(get().iframeDoc, {
        mode: "remodel",
        editableIds: editableIds,
      });
    });

    // 7. Store configuration, history, and active remodeling metadata in Zustand
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

    // 8. Update root attributes such as name, category, and title inside the editor workspace
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
    // 1. Validate builder workflow state
    if (get().state === "ready") {
      throw new Error("Not building or remodeling a component.");
    }

    const displayName = (
      appState.data.root?.props as {
        _name?: string;
      }
    )?._name?.trim();

    // Soft components require a name to generate a registration key
    if (!displayName) {
      throw new Error("Root component must have a name to compose.");
    }

    const itemSelector = get().itemSelector;

    if (!itemSelector) {
      throw new Error("No item selector found for completed component.");
    }

    // 2. Resolve the original workspace item that was modified or designated as builder target
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

    // 3. Generate a safe, unique PascalCase key for registering the component in Puck
    const componentName = componentNameFromLabel(displayName, get().overrides, {
      ...(rootProps || {}),
      existingKeys: Object.keys(get().softComponents),
      state: get().state,
    });

    if (!componentName) {
      throw new Error("Failed to generate component key from name.");
    }

    // 4. Compile the workspace's elements and fields into a versioned soft component configuration
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

    // 5. Restore standard undo/redo history captured before launching the builder session
    const storedHistories = get().originalHistory;
    setHistories([...storedHistories]);

    const config = { ...(get().softConfig || initialConfig) };

    const mapComponentConfig = get().overrides.mapComponentConfig;

    // 6. Apply custom configuration transformers/mappers if provided in overrides
    const newSoftComponentConfig: ComponentConfig = mapComponentConfig
      ? mapComponentConfig(componentName, defaultSoftComponentConfig, rootProps)
      : defaultSoftComponentConfig;

    // 7. Register the newly created/remodelled component and categories within core soft configuration
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

      // Insert component key into designated layout/toolbox categories
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
        state: "inspecting", // Temporarily shift state to inspect() before finalizing back to ready
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
        `Completed soft component "${componentName}" version "${version}" not found.`,
      );
    }

    // 8. Re-compile other soft components in the system that depend on this component
    get().rebuildDependents(componentName, version);

    return {
      id: componentName,
      version,
      softComponent: completedSoftComponent,
    };
  },

  inspect: (componentName, puckDispatch) => {
    // 1. Enforce correct inspection state
    if (get().state !== "inspecting") {
      throw new Error("Not in inspecting state.");
    }

    const selector = { ...get().itemSelector };

    if (selector?.index === undefined || !selector?.zone) {
      throw new Error("No selector found for last item.");
    }

    const editableComponentId = get().editingComponentId;

    // 2. Perform the swap inside the editor workspace document data
    requestAnimationFrame(() => {
      const config = get().softConfig;
      const newComponent = config.components[componentName];

      // Reconstruct document tree, replacing the temporary seed item with the finished component
      const reconstructedTree = (data: Data) =>
        walkTree(data, config, (components) => {
          return components.map((comp) => {
            if (comp.props.id === editableComponentId) {
              // Swap in the newly compiled component type and default versioned props
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
        recordHistory: true, // Record this swap on the standard undo/redo stack
      });

      // 3. Purge iframe edit overlay boundaries
      clearEditVisibility(get().iframeDoc);

      // 4. Clear active builder metadata and restore store state to "ready"
      set((s) => ({
        ...s,
        state: "ready",
        setItemSelector: undefined,
        setOriginalItem: undefined,
        editingComponent: null,
        editingComponentId: null,
        editableComponentIds: new Set(),
      }));
    });
  },

  cancel: (setHistories) => {
    const storedHistories = get().originalHistory;

    // 1. Lock workspace state to "cancelling" to suppress conflicting visual rendering updates
    set((s) => ({
      ...s,
      state: "cancelling",
    }));

    // 2. Re-apply history stacks from before launch
    setHistories([...storedHistories]);

    requestAnimationFrame(() => {
      // 3. Clear visual highlight boundary elements inside the editor iframe
      clearEditVisibility(get().iframeDoc);

      // 4. Restore original soft configurations and reset tracked states
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
    });
  },

  compose: (appState, componentName, editedItem, displayName, category) => {
    // 1. Validate parameters
    if (!componentName) {
      throw new Error("Root component must have a name to compose.");
    }

    const componentConfigs = get().softConfig.components;

    // 2. Prevent namespace collision inside config during fresh builds
    if (
      get().state === "building" &&
      Object.keys(componentConfigs).includes(componentName)
    ) {
      throw new Error(
        `Component name "${componentName}" already exists in the configuration.`,
      );
    }

    // 3. Execute conversion from editor document tree structure into soft component JSON schema
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

    // 4. Track historical versions and determine if this is a newly introduced version key
    const existingComponent = get().softComponents[componentName];
    const allVersions = Object.keys(existingComponent?.versions || {});
    const isNewVersion = !allVersions.includes(version);

    // 5. Package the versioned configuration schema for Puck registry
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

    // 6. Persist the compiled version schema into local storage via Zustand slice
    get().setSoftComponent(componentName, version, softComponent);

    return [newSoftComponentConfig, version];
  },

  decompose: (componentData) => {
    if (!componentData?.type || !componentData?.props.id) {
      throw new Error("Component data must have type and id to decompose.");
    }

    // Delegate structural decomposition to dedicated library function
    return decomposeSoftComponent(componentData, get().softComponents);
  },

  demolish: (componentName, data, puckDispatch) => {
    if (get().state !== "ready") {
      throw new Error("Components can only be demolished in ready state.");
    }

    // 1. Remove registrations and filter out the demolished component instances from active workspace data
    const result = demolishSoftComponent(
      componentName,
      data,
      get().softConfig,
      get().softComponents,
    );

    // 2. Re-apply cleaned document data to Puck workspace
    puckDispatch({
      type: "setData",
      data: result.data,
    });

    // 3. Clean registries and softComponents mapping in Zustand store
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

    // 1. Fetch metadata and version definition schemas from the store
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

    // 2. Convert target version's compiled schema back to standard constituent components
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

    // 3. Swap the active remodeling workspace content in-place with the selected version's elements
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
