"use client";

import { Config } from "@measured/puck";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { appStoreContext } from "./useStore";
import { createSoftConfigStore } from "../store";
import { SoftComponents } from "../types/SoftComponent";

export const SoftConfigProvider = ({
  children,
  hardConfig,
  softComponents,
}: {
  children: (softConfig: Config, softComponents: SoftComponents) => ReactNode;
  hardConfig: Config;
  softComponents: SoftComponents;
}) => {
  const store = useMemo(
    () => createSoftConfigStore(hardConfig, softComponents),
    [hardConfig, softComponents]
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
      {children(softConfig as Config, internalSoftComponents)}
    </appStoreContext.Provider>
  );
};
