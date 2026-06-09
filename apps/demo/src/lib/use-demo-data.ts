import { useEffect, useState } from "react";
import config, { componentKey } from "../config";
import { initialData } from "../config/initial-data";
import { Data, resolveAllData, Config } from "@puckeditor/core";
import { ComponentProps } from "../config";
import { resolveSoftConfig, SoftComponents } from "@netlisian/softconfig/puck";

const isBrowser = typeof window !== "undefined";

type DemoStorage = {
  data?: Partial<Data>;
  resolvedData?: Partial<Data>;
  styles?: string;
  // Legacy fields
  softComponents?: SoftComponents;
  softConfig?: Partial<Config>;
};

type GlobalSoftStorage = {
  softComponents?: SoftComponents;
  softConfig?: Partial<Config>;
};

export const useDemoData = ({
  path,
  isEdit,
}: {
  path: string;
  isEdit: boolean;
}) => {
  const storageKey = `puck-demo:${componentKey}:${path}:storage`;
  const globalSoftKey = `puck-demo:${componentKey}:global:softComponents`;

  const [storage, setStorage] = useState<DemoStorage>(() => {
    if (isBrowser) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          return JSON.parse(stored) as DemoStorage;
        } catch (error) {
          console.error("Failed to parse stored demo storage:", error);
          return (
            (initialData as any)[path as string] || {}
          );
        }
      }

      return (
        (initialData as any)[path as string] || {}
      );
    }
    return {};
  });

  const [globalSoft, setGlobalSoft] = useState<GlobalSoftStorage>(() => {
    if (isBrowser) {
      const globalStored = localStorage.getItem(globalSoftKey);
      if (globalStored) {
        try {
          return JSON.parse(globalStored) as GlobalSoftStorage;
        } catch (error) { }
      }

      // Migration: fallback to path storage if global doesn't exist
      const pathStored = localStorage.getItem(storageKey);
      if (pathStored) {
        try {
          const parsed = JSON.parse(pathStored);
          if (parsed.softComponents) {
            return {
              softComponents: parsed.softComponents,
              softConfig: parsed.softConfig,
            };
          }
        } catch (e) { }
      }

      const initialPathData = (initialData as any)[path as string] || {};
      if (initialPathData.softComponents) {
        return {
          softComponents: initialPathData.softComponents,
        };
      }
    }
    return {};
  });

  const data = storage.data || {};
  const softComponents = globalSoft.softComponents || {};
  const resolvedData = storage.resolvedData;

  useEffect(() => {
    if (!isEdit) {
      const title = data?.root?.props?.title || data?.root?.title;
      document.title = title || "";
    }
  }, [data, isEdit]);

  const saveData = async (
    newData: Partial<Data>,
    newSoftComponents: SoftComponents,
    styles?: string,
    softConfig?: Partial<Config>
  ) => {
    const resolved = await resolveAllData<ComponentProps, {}>(newData, config, {});
    const decomposedData = resolveSoftConfig(
      resolved as Data,
      newSoftComponents,
      config
    );

    const newStorage: DemoStorage = {
      data: newData,
      resolvedData: decomposedData,
      styles: styles,
    };

    const newGlobalSoft: GlobalSoftStorage = {
      softComponents: newSoftComponents,
      softConfig: softConfig,
    };

    setStorage(newStorage);
    setGlobalSoft(newGlobalSoft);

    if (isBrowser) {
      localStorage.setItem(storageKey, JSON.stringify(newStorage));
      localStorage.setItem(globalSoftKey, JSON.stringify(newGlobalSoft));
    }
  };

  const saveSoftComponents = (newSoftComponents: SoftComponents) => {
    const newGlobalSoft: GlobalSoftStorage = {
      ...globalSoft,
      softComponents: newSoftComponents,
    };
    setGlobalSoft(newGlobalSoft);
    if (isBrowser) {
      localStorage.setItem(globalSoftKey, JSON.stringify(newGlobalSoft));
    }
  };

  return {
    data,
    resolvedData: storage.resolvedData || resolvedData,
    softComponents,
    softConfig: globalSoft.softConfig,
    styles: storage.styles,
    saveData,
    saveSoftComponents,
    storageKey,
  };
};

export const useDemoCollection = () => {
  const globalSoftKey = `puck-demo:${componentKey}:global:softComponents`;

  const [globalSoft, setGlobalSoft] = useState<GlobalSoftStorage>(() => {
    if (isBrowser) {
      const globalStored = localStorage.getItem(globalSoftKey);
      if (globalStored) {
        try {
          return JSON.parse(globalStored) as GlobalSoftStorage;
        } catch (error) { }
      }
    }
    return {};
  });

  const [collection, setCollection] = useState<Record<string, DemoStorage>>(() => {
    if (isBrowser) {
      const coll: Record<string, DemoStorage> = {};
      const prefix = `puck-demo:${componentKey}:`;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && key.endsWith(":storage")) {
          const path = key.substring(prefix.length, key.length - ":storage".length);
          try {
            coll[path] = JSON.parse(localStorage.getItem(key)!) as DemoStorage;

            // Migration logic for collection loading
            if (coll[path]?.softComponents && !globalSoft.softComponents) {
              const newGlobalSoft = {
                softComponents: coll[path].softComponents,
                softConfig: coll[path].softConfig,
              };
              setGlobalSoft(newGlobalSoft);
              localStorage.setItem(globalSoftKey, JSON.stringify(newGlobalSoft));
            }
          } catch (e) { }
        }
      }

      Object.entries(initialData).forEach(([path, data]) => {
        if (!coll[path]) {
          coll[path] = { data: data as Partial<Data> };
        }
      });
      return coll;
    }
    return {};
  });

  const saveBatch = async (batch: Record<string, Partial<Data>>) => {
    const newCollection = { ...collection };
    for (const [path, data] of Object.entries(batch)) {
      const existing = newCollection[path] || {};
      const resolved = await resolveAllData<ComponentProps, {}>(data as any, config, {});
      const decomposedData = resolveSoftConfig(
        resolved as Data,
        globalSoft.softComponents || {},
        config
      );

      const newStorage: DemoStorage = {
        ...existing,
        data,
        resolvedData: decomposedData,
      };

      newCollection[path] = newStorage;
      if (isBrowser) {
        localStorage.setItem(`puck-demo:${componentKey}:${path}:storage`, JSON.stringify(newStorage));
      }
    }
    setCollection(newCollection);
  };

  const savePage = async (path: string, newData: Partial<Data>) => {
    await saveBatch({ [path]: newData });
  };

  const removePages = async (paths: string[]) => {
    const newCollection = { ...collection };
    paths.forEach((path) => {
      delete newCollection[path];
      if (isBrowser) {
        localStorage.removeItem(`puck-demo:${componentKey}:${path}:storage`);
      }
    });
    setCollection(newCollection);
  };

  const saveSoftComponents = (newSoftComponents: SoftComponents) => {
    const newGlobalSoft: GlobalSoftStorage = {
      ...globalSoft,
      softComponents: newSoftComponents,
    };
    setGlobalSoft(newGlobalSoft);
    if (isBrowser) {
      localStorage.setItem(globalSoftKey, JSON.stringify(newGlobalSoft));
    }
  };

  return { collection, saveBatch, savePage, removePages, softComponents: globalSoft.softComponents || {}, saveSoftComponents };
};
