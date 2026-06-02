"use client";

import { Config } from "@measured/puck";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { appStoreContext } from "./useStore";
import { createSoftConfigStore } from "../store";
import type { AppStore } from "../store";
import type { SoftComponents } from "../types/SoftComponent";
import type { Overrides } from "../types/Overrides";
import type { OnActionsCallback } from "../types/ActionEvents";
import type { CustomFields } from "../types/SoftFields";
import type { StoreApi } from "zustand";

/**
 * SoftConfigProvider is responsible for providing the soft config context to the Puck editor.
 *
 * @param props - The component props.
 * @param props.children - A render prop that receives the following arguments:
 * - `softConfig`: The current soft configuration object.
 * - `softComponents`: The current mapping of soft components.
 * - `setIframeDoc`: Function to set the iframe document reference in the store. Used to apply edit visibility styles on the iframe.
 * - `validateAction`: Function to validate actions based on current state and editable component IDs. Used to disallow editing components that are not in the editable list during "building" or "remodeling" states.
 * @param props.hardConfig - Initial Puck Config.
 * @param props.softComponents - Initial soft components.
 * @param props.customFields - Custom field to allow additional field types.
 * @param props.overrides - Soft Config overrides.
 * @param props.value - Optional external store API.
 * @param props.onActions - Callback triggered on Puck actions.
 * @param props.useVersioning - Flag to enable or disable versioning (defaults to false).
 */
export const SoftConfigProvider = ({
  children,
  hardConfig,
  softComponents,
  customFields,
  overrides,
  value,
  onActions,
  useVersioning = false,
}: {
  children: (softConfig: Config) => ReactNode;
  hardConfig: Config;
  softComponents?: SoftComponents;
  customFields?: CustomFields;
  overrides?: Overrides;
  value?: StoreApi<AppStore>;
  onActions?: OnActionsCallback;
  useVersioning?: boolean;
}) => {
  const store = useMemo(
    () =>
      value ??
      createSoftConfigStore(
        hardConfig,
        softComponents,
        overrides,
        onActions,
        useVersioning,
        customFields,
      ),
    [value],
  );

  const [softConfig, setSoftConfig] = useState(
    () => store.getState().softConfig,
  );
  useEffect(() => {
    let prev = store.getState().softConfig;
    const unsubscribe = store.subscribe((state) => {
      if (state.softConfig !== prev) {
        prev = state.softConfig;
        setSoftConfig(state.softConfig);
      }
    });
    return unsubscribe;
  }, [store]);

  return (
    <appStoreContext.Provider value={store}>
      {children(softConfig as Config)}
    </appStoreContext.Provider>
  );
};
