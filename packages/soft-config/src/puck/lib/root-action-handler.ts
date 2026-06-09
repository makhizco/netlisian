"use client";
import { DefaultComponentProps, AppState, OnAction, ComponentData } from "@measured/puck";
import { AppStore } from "../store";
import { NodeIndex, ZoneIndex } from "..";
import { GlobalRootProps } from "../types/BuilderConfig";

import isEqual from "react-fast-compare";
import { MapEntry } from "../types/Mapping";
import { applyMapping } from "./apply-mapping";

let currentGeneration = 0;

function hasDefaultValueChanged(
  prev?: unknown,
  curr?: unknown
): boolean {
  if (!prev && !curr) return false;
  if (!prev || !curr) return true;

  if (!isEqual((prev as DefaultComponentProps)?.defaultValue, (curr as DefaultComponentProps)?.defaultValue)) return true;

  if ((prev as DefaultComponentProps)?.subFieldSettings || (curr as DefaultComponentProps)?.subFieldSettings) {
    const subKeys = new Set([
      ...Object.keys((prev as DefaultComponentProps)?.subFieldSettings || {}),
      ...Object.keys((curr as DefaultComponentProps)?.subFieldSettings || {}),
    ]);
    for (const subKey of subKeys) {
      if (
        hasDefaultValueChanged(
          ((prev as DefaultComponentProps)?.subFieldSettings as DefaultComponentProps)?.[subKey],
          ((curr as DefaultComponentProps)?.subFieldSettings as DefaultComponentProps)?.[subKey]
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

const processReplacements = async (
  appState: AppState,
  get: () => AppStore,
  fieldSettings: DefaultComponentProps,
  changedKeys: Set<string>,
  zones: ZoneIndex,
  nodes: NodeIndex
) => {
  const generation = ++currentGeneration;

  // Debounce: Wait 150ms to see if user keeps typing
  await new Promise((resolve) => setTimeout(resolve, 150));

  // If currentGeneration has incremented, it means a newer call started during the 150ms wait.
  // So we cancel this outdated execution.
  if (generation !== currentGeneration) return;

  const { puckDispatch, editableComponentIds } = get();
  if (!puckDispatch) return;

  if (changedKeys.size === 0) return;

  const replacements: Array<{
    id: string;
    data: ComponentData;
  }> = [];

  // Filter to only include components from editable areas if an editable array is provided
  const editableSet = new Set(editableComponentIds || []);
  const hasEditableFilter = editableSet.size > 0;

  const nodeEntries = Object.entries(nodes);

  for (let i = 0; i < nodeEntries.length; i++) {
    if (generation !== currentGeneration) return;

    if (i > 0 && i % 50 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (generation !== currentGeneration) return;
    }

    const [id, node] = nodeEntries[i];

    if (hasEditableFilter && !editableSet.has(id)) {
      continue;
    }

    // Ensure the component actually has mapping configured
    const map = (node.data.props?._map || []) as MapEntry[];
    if (!map.length) continue;

    let isAffected = false;
    const flatProps = node.flatData?.props || {};

    // Fast O(K) substring lookup through flatData properties to see if this component
    // depends on any of the field keys that were modified in the root props
    for (const [flatKey, flatValue] of Object.entries(flatProps)) {
      if (
        flatKey.includes("_map") &&
        flatKey.includes("from") &&
        typeof flatValue === "string"
      ) {
        if (
          changedKeys.has(flatValue) ||
          Array.from(changedKeys).some(
            (ck) =>
              flatValue.startsWith(ck + ".") ||
              flatValue.startsWith(ck + "[")
          )
        ) {
          isAffected = true;
          break;
        }
      }
    }

    if (!isAffected) continue;

    // Calculate the new mapped prop values
    const { newProps } = applyMapping(
      { ...node.data.props },
      fieldSettings,
      map,
      "fieldSettings"
    );

    // Package the updated component payload
    replacements.push({
      id,
      data: {
        ...node.data,
        props: {
          ...node.data.props,
          ...(newProps as typeof node.data.props),
        },
      },
    });
  }

  if (!replacements.length) return;

  // Dispatch a "replace" action for every successfully re-mapped component
  requestAnimationFrame(() => {
    replacements.forEach((replacement) => {
      const node = nodes[replacement.id];
      if (!node) return;
      const zoneName = `${node.parentId}:${node.zone}`
      const index = zones[zoneName]?.contentIds.indexOf(replacement.id);

      if (index !== undefined && index !== -1) {

        puckDispatch({
          type: "replace",
          destinationIndex: index,
          destinationZone: zoneName,
          data: replacement.data,
          ui: undefined,
        });
      }
    })
  });
};

const processVersionChange = (
  rootProps: DefaultComponentProps,
  get: () => AppStore,
  zones: ZoneIndex,
  nodes: NodeIndex
) => {
  const currentVersion = rootProps._version;
  const versions = rootProps._versions || [];

  if (versions.includes(currentVersion) && versions.length > 1) {
    const puckDispatch = get().puckDispatch;
    if (puckDispatch) {
      get().builder.setVersion(
        rootProps._name,
        currentVersion,
        rootProps,
        puckDispatch,
        // Mock getItemBySelector using indexes
        (selector) => {
          if (!selector.zone) return undefined;
          const id = zones[selector.zone]?.contentIds[selector.index];
          return id ? nodes[id].data : undefined;
        },
        // Mock getSelectorForId using indexes
        (id) => {
          const node = nodes[id];
          if (!node) return undefined;
          const index = zones[node.zone]?.contentIds.indexOf(id);
          return { zone: node.zone, index };
        }
      );
    }
  }
};

export const rootActionHandler: (
  set: (
    partial:
      | AppStore
      | Partial<AppStore>
      | ((state: AppStore) => AppStore | Partial<AppStore>),
    replace?: false,
  ) => void,
  get: () => AppStore,
) => OnAction = (
  set,
  get,
) => (action, appState, previousState) => {
  const storeState = get().state;
  if (
    (storeState !== "building" && storeState !== "remodeling") ||
    action.type !== "replaceRoot"
  ) {
    return;
  }

  const { zones, nodes } = (
    appState as AppState & {
      indexes: {
        nodes: NodeIndex;
        zones: ZoneIndex;
      };
    }
  ).indexes;

  const rootProps = (appState.data.root as GlobalRootProps).props;
  const previousRootProps = (previousState?.data.root as GlobalRootProps).props;

  const fieldSettings = rootProps?._fieldSettings;
  const previousFieldSettings = previousRootProps?._fieldSettings;

  // --- Map Replacements (Field Settings) ---
  if (fieldSettings) {
    const changedKeys = new Set<string>();
    const allKeys = new Set([
      ...Object.keys(previousFieldSettings || {}),
      ...Object.keys(fieldSettings || {}),
    ]);

    for (const key of allKeys) {
      if (hasDefaultValueChanged(previousFieldSettings?.[key], fieldSettings?.[key])) {
        changedKeys.add(key);
      }
    }

    if (changedKeys.size > 0) {
      processReplacements(appState, get, fieldSettings, changedKeys, zones, nodes);
    }
  }

  // --- Versioning Logic Migration ---
  if (
    storeState === "remodeling" &&
    rootProps?._version &&
    rootProps?._name &&
    rootProps?._version !== previousRootProps?._version
  ) {
    processVersionChange(rootProps, get, zones, nodes);
  }
};