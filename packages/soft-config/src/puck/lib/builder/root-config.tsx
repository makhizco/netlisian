import React, { useEffect } from "react";
import equal from "react-fast-compare";
import {
  AsFieldProps,
  Config,
  createUsePuck,
  Field,
  RootConfig,
  RootData,
  walkTree,
  WithChildren,
  WithId,
} from "@measured/puck";
import { BuilderRootConfig } from "../../types/BuilderConfig";
import getFieldSettings from "../get-field-settings";
import { useSoftConfig } from "../../context/useStore";
import { AppStore } from "../../store";
import { applyMapping } from "../apply-mapping";
import type { MapEntry } from "../../types/Mapping";

const useCustomPuck = createUsePuck();

const breakVersion = (version: string) => {
  const [major, minor, patch] = version.split(".").map((v) => parseInt(v));
  return [major, minor, patch];
};

const updateVersion = (
  version: string,
  increment: "major" | "minor" | "patch"
) => {
  let [major, minor, patch] = breakVersion(version);
  if (increment === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (increment === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
};

const getSerializableProps = (props: WithId<Record<string, any>>) => {
  const cleanProps: WithId<{
    [x: string]: any;
  }> = {
    id: props.id, 
  };

  for (const key in props) {
    const value = props[key];

    // 1. Drop known Puck injected keys (but KEEP 'id', Puck needs it)
    if (["children", "puck", "editMode"].includes(key)) continue;

    // 2. Drop React Elements. React nodes are objects that contain a $$typeof symbol.
    if (value && typeof value === "object" && value.$$typeof) continue;

    // 3. Drop any injected functions or callbacks
    if (typeof value === "function") continue;

    // If it passed the checks, it's safe serializable data
    cleanProps[key] = value;
  }

  return cleanProps;
};

export const builderRootConfig = (
  config: Config,
  overrides: AppStore["overrides"],
  editingComponent?: string,
  showVersionFields: boolean = true
): RootConfig<BuilderRootConfig> => ({
  fields: {
    _name: (overrides.name || {
      type: "text",
      label: "Soft Component Name",
    }) as Field,
    _category: (overrides.categories || {
      type: "select",
      label: "Category",
      options: [
        ...(Object.keys(config.categories || {}).map((cat) => ({
          label: config.categories?.[cat].title || cat,
          value: cat,
        })) || []),
        {
          label: Object.keys(config.categories || {}).length
            ? "Other"
            : "Uncategorized",
          value: undefined,
        },
      ],
    }) as Field,
    _fields: {
      type: "array",
      label: "Fields",
      defaultItemProps: {
        name: "New Field",
        type: "text",
      },
      getItemSummary(
        item: { name: string; type: Field["type"] },
        index?: number
      ) {
        return item.name || `Field ${(index || 0) + 1}`;
      },
      arrayFields: {
        name: { type: "text", label: "Name" },
        type: {
          type: "select",
          label: "Type",
          options: [
            { label: "Text", value: "text" },
            { label: "Textarea", value: "textarea" },
            { label: "Number", value: "number" },
            { label: "Select", value: "select" },
            { label: "Radio", value: "radio" },
            { label: "Array", value: "array" },
            { label: "Object", value: "object" },
            // { label: "Reference", value: "reference" },
          ],
        },
      },
    } as Field,
    ...(overrides.additionalRootFields || {}),
  },
  resolveFields({ props: data }, { fields, changed }) {
    const newFields = { ...fields };

    if (changed._fields || changed._fieldSettings) {
      if (data?._fields?.length) {
        newFields._fieldSettings = {
          type: "object",
          label: "Field Settings",
          objectFields: getFieldSettings(
            data!._fields || [],
            data!._fieldSettings || {}
          ),
        };
      } else {
        delete newFields._fieldSettings;
      }
    }

    // if (showVersionFields && data?._versions?.length) {
    //   const latestVersion = data._versions[data._versions.length - 1] || "1.0.0";

    //   newFields._version = {
    //     type: "select",
    //     label: "Version",
    //     options: [
    //       ...data._versions.map((v: string) => ({ label: v, value: v })),
    //       {
    //         label: `${updateVersion(latestVersion, "patch")} (Patch)`,
    //         value: updateVersion(latestVersion, "patch"),
    //       },
    //       {
    //         label: `${updateVersion(latestVersion, "minor")} (Minor)`,
    //         value: updateVersion(latestVersion, "minor"),
    //       },
    //       {
    //         label: `${updateVersion(latestVersion, "major")} (Major)`,
    //         value: updateVersion(latestVersion, "major"),
    //       },
    //     ],
    //   } as Field;
    // } else {
    //   delete newFields._version;
    // }

    return newFields; // Return the new object
  },
  // resolveData: (props, params) => {
  //   if (overrides.resolveRootData) {
  //     return overrides.resolveRootData(props, params, { editingComponent });
  //   }

  //   const result: {
  //     props: RootData<AsFieldProps<WithChildren<BuilderRootConfig>>>;
  //     readOnly: Readonly<Record<string, boolean>> | undefined;
  //   } = {
  //     props,
  //     readOnly: undefined,
  //   };

  //   return result;
  // },
  render: (props) => {
    const fieldSettings = props?._fieldSettings;
    const data = useCustomPuck((s) => s.appState.data);
    const dispatch = useCustomPuck((s) => s.dispatch);
    const getSelectorForId = useCustomPuck((s) => s.getSelectorForId);
    const setVersion = useSoftConfig((s) => s.builder.setVersion);
    const state = useSoftConfig((s) => s.state);

    useEffect(() => {
      if (!fieldSettings || Object.keys(fieldSettings).length === 0) return;

      const replacements: Array<{
        id: string;
        data: any;
      }> = [];

      walkTree(
        {
          content: data?.content || [],
          root: data?.root || {},
        },
        {
          components: config.components,
        },
        (content) =>
          content.map((child) => {
            const map = (child.props?._map || []) as MapEntry[];
            if (!map.length) return child;

            const cleanProps = getSerializableProps(child.props);
            const { newProps, changed } = applyMapping(
              cleanProps,
              fieldSettings,
              map,
              "fieldSettings"
            );

            // `applyMapping` can touch array bases in stages when several rows
            // target the same base. Skip replace unless the fully composed
            // serializable props actually changed; otherwise we can loop.
            if (!changed || equal(cleanProps, newProps)) return child;

            replacements.push({
              id: child.props.id,
              data: { ...child, props: newProps as typeof child.props },
            });

            return child;
          })
      );

      if (!replacements.length) return;

      replacements.forEach((replacement) => {
        const itemSelector = getSelectorForId(replacement.id);
        if (!itemSelector) return;

        dispatch({
          type: "replace",
          data: replacement.data,
          destinationIndex: itemSelector.index,
          destinationZone: itemSelector.zone,
        });
      });
    }, [fieldSettings, data, dispatch, getSelectorForId]);

    useEffect(() => {
      if (state !== "remodeling" || !props?._version || !props?._name) return;
      const currentVersion = props._version;
      if (props._versions?.includes(currentVersion) && props._versions.length > 1) {
        setVersion(props._name, currentVersion, props, dispatch);
      }
    }, [props?._version]);

    return <>{props.children}</>;
  },
});

