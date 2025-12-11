"use client";

import { Config } from "@measured/puck";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { appStoreContext } from "./useStore";
import { createSoftConfigStore } from "../store";
import type { AppStore } from "../store";
import type { SoftComponents } from "../types/SoftComponent";
import type { Overrides } from "../types/Overrides";
import type { StoreApi } from "zustand";

export const SoftConfigProvider = ({
  children,
  hardConfig,
  softComponents,
  overrides,
  value,
}: {
  children: (softConfig: Config, softComponents: SoftComponents) => ReactNode;
  hardConfig: Config;
  softComponents: SoftComponents;
  overrides: Overrides;
  value?: StoreApi<AppStore>;
}) => {
  const store = value ?? useMemo(
    () => createSoftConfigStore(hardConfig, softComponents, overrides),
    [hardConfig, softComponents, overrides]
  );
  const [softConfig, setSoftConfig] = useState(
    () => store.getState().softConfig
  );
  const [internalSoftComponents, setSoftComponents] = useState(
    () => store.getState().softComponents
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setSoftConfig(store.getState().softConfig);
      setSoftComponents(store.getState().softComponents);
    });
    return () => {
      unsubscribe();
    };
  }, [store]);

  return (
    <appStoreContext.Provider value={store}>
      {children(softConfig as Config , internalSoftComponents)}
    </appStoreContext.Provider>
  );
};
