import { useEffect, useState } from "react";
import config, { componentKey } from "../config";
import { initialData } from "../config/initial-data";
import { Data, resolveAllData } from "@measured/puck";
import { ComponentProps } from "../config";
import { resolveSoftConfig, SoftComponents } from "@netlisian/softconfig/puck";

const isBrowser = typeof window !== "undefined";

type DemoStorage = {
  data?: Partial<Data>;
  softComponents?: SoftComponents;
};

export const useDemoData = ({
  path,
  isEdit,
}: {
  path: string;
  isEdit: boolean;
}) => {
  // single storage key that holds both data and softComponents
  const storageKey = `puck-demo:${componentKey}:${path}:storage`;

  const [storage, setStorage] = useState<DemoStorage>(() => {
    if (isBrowser) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          return JSON.parse(stored) as DemoStorage;
        } catch (error) {
          console.error("Failed to parse stored demo storage:", error);
          // fall back to initialData for this path
          return (
            (
              initialData as Record<
                string,
                { data?: Partial<Data>; softComponents?: SoftComponents }
              >
            )[path as string] || {}
          );
        }
      }

      return (
        (
          initialData as Record<
            string,
            { data?: Partial<Data>; softComponents?: SoftComponents }
          >
        )[path as string] || {}
      );
    }
    return {};
  });

  const data = storage.data || {};
  const softComponents = storage.softComponents || {};

  // Normally this would happen on the server, but we can't
  // do that because we're using local storage as a database
  const [resolvedData, setResolvedData] = useState<Partial<Data>>();

  useEffect(() => {
    if (data && !isEdit) {
      resolveAllData<ComponentProps, {}>(data, config, {}).then((resolved) => {
        const decomposedData = resolveSoftConfig(
          resolved as Data,
          softComponents,
          config
        );

        setResolvedData(decomposedData);
      });
    }
  }, [data, isEdit]);

  useEffect(() => {
    if (!isEdit) {
      const title = data?.root?.props?.title || data?.root?.title;
      document.title = title || "";
    }
  }, [data, isEdit]);

  // Function to save data and softComponents into the single storage object
  const saveData = (
    newData: Partial<Data>,
    newSoftComponents: SoftComponents
  ) => {

    const newStorage: DemoStorage = {
      data: newData,
      softComponents: newSoftComponents,
    };

    setStorage(newStorage);

    if (isBrowser) {
      localStorage.setItem(storageKey, JSON.stringify(newStorage));
    }
  };

  return {
    data,
    resolvedData,
    softComponents,
    saveData,
    storageKey
  };
};
