"use client";
import React, { useEffect } from "react";
import isEqual from "react-fast-compare";
import {
  AsFieldProps,
  ComponentConfig,
  ComponentData,
  Config,
  Content,
  createUsePuck,
  Field,
  Fields,
  RootConfig,
  RootData,
  walkTree,
  WithChildren,
  WithId,
} from "@measured/puck";
import { BuilderRootConfig } from "../../types/BuilderConfig";
import getFieldSettings from "../get-field-settings";
import { useSoftConfig } from "../../context/useStore";
import { AppStore, Status } from "../../store";
import { applyMapping } from "../apply-mapping";
import { getCustomFieldTypeOptions } from "../custom-fields";
import type { MapEntry } from "../../types/Mapping";
import type { CustomFields } from "../../types/SoftFields";
import { getPropertyByPath } from "../get-prop-by-path";

const breakVersion = (version: string) => {
  const [major, minor, patch] = version.split(".").map((v) => parseInt(v));
  return [major, minor, patch];
};

const updateVersion = (
  version: string,
  increment: "major" | "minor" | "patch",
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

const getSerializableProps = (
  props: WithId<Record<string, any>>,
  componentConfig: ComponentConfig,
) => {
  const cleanProps: WithId<{
    [x: string]: any;
  }> = {
    id: props.id,
  };

  for (const key in props) {
    const value = props[key];

    // 1. Drop known Puck injected keys (but KEEP 'id', Puck needs it)
    if (["children", "puck", "editMode", "_map"].includes(key)) continue;

    // 2. Drop React Elements. React nodes are objects that contain a $$typeof symbol.
    if (value && typeof value === "object") {
      if (value.$$typeof) {
        return undefined;
      }
      const serializableChild = getSerializableProps(value, componentConfig);
      if (serializableChild !== undefined) {
        cleanProps[key] = serializableChild;
      }
    }

    // 3. Drop any injected functions or callbacks
    if (typeof value === "function") continue;

    // If it passed the checks, it's safe serializable data
    cleanProps[key] = value;
  }

  return cleanProps;
};

function safeDeepClone(obj: any): any {
  // Primitives
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Ignore React elements
  if (obj.$$typeof) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => {
      const cloned = safeDeepClone(item);
      return cloned === undefined ? null : cloned;
    });
  }

  const cloned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === "function") continue;

      const clonedVal = safeDeepClone(val);
      if (clonedVal !== undefined) {
        cloned[key] = clonedVal;
      }
    }
  }
  return cloned;
}

export const buildBaseRoot = (
  config: Config,
  overrides: AppStore["overrides"],
  customFields: CustomFields,
  selectors: {
    getState: () => Status;
    getShowVersionFields: () => boolean;
    getEditingComponent: () => string | null;
  },
): RootConfig<BuilderRootConfig> => {
  const { getState, getShowVersionFields, getEditingComponent } = selectors;
  const customTypeOptions = getCustomFieldTypeOptions(customFields);

  return {
    fields: config.root?.fields ?? {},
    defaultProps: config.root?.defaultProps ?? {},

    resolveFields({ props: data }, params) {
      const state = getState();
      const { fields, changed } = params;

      if (state !== "building" && state !== "remodeling") {
        return fields;
      }
      const showVersionFields = getShowVersionFields();

      // Builder mode fields
      const builderFields = {
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
          getItemSummary(item: { name: string; type: string }, index?: number) {
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
                ...customTypeOptions,
              ],
            },
          },
        } as Field,
        ...(overrides.additionalRootFields || {}),
      };

      const newFields: Fields<BuilderRootConfig> = {
        ...fields,
        ...builderFields,
      };
      const rootFields: NonNullable<BuilderRootConfig["_fields"]> =
        Array.isArray((data as BuilderRootConfig | undefined)?._fields)
          ? (((data as BuilderRootConfig | undefined)?._fields ||
              []) as NonNullable<BuilderRootConfig["_fields"]>)
          : [];
      const rootFieldSettings = ((data as BuilderRootConfig | undefined)
        ?._fieldSettings || {}) as NonNullable<
        BuilderRootConfig["_fieldSettings"]
      >;

      if (changed._fields || changed._fieldSettings) {
        if (rootFields.length) {
          newFields._fieldSettings = {
            type: "object",
            label: "Field Settings",
            objectFields: getFieldSettings(
              rootFields,
              rootFieldSettings,
              customFields,
            ),
          };
        } else {
          delete newFields._fieldSettings;
        }
      }

      if (
        showVersionFields &&
        (data as BuilderRootConfig | undefined)?._versions?.length
      ) {
        const latestVersion =
          (data as BuilderRootConfig | undefined)?._versions?.[
            (data as BuilderRootConfig)?._versions!.length - 1
          ] || "1.0.0";

        newFields._version = {
          type: "select",
          label: "Version",
          options: [
            ...(((data || {}) as BuilderRootConfig)._versions as string[]).map(
              (v: string) => ({
                label: v,
                value: v,
              }),
            ),
            {
              label: `${updateVersion(latestVersion, "patch")} (Patch)`,
              value: updateVersion(latestVersion, "patch"),
            },
            {
              label: `${updateVersion(latestVersion, "minor")} (Minor)`,
              value: updateVersion(latestVersion, "minor"),
            },
            {
              label: `${updateVersion(latestVersion, "major")} (Major)`,
              value: updateVersion(latestVersion, "major"),
            },
          ],
        } as Field;
      } else {
        delete newFields._version;
      }

      return newFields; // Return the new object
    },
    resolveData: (data, params) => {
      if (overrides.resolveRootData) {
        return overrides.resolveRootData(data, params, {
          editingComponent: getEditingComponent() || undefined,
        });
      }

      return {
        props: data.props,
        readOnly: data.readOnly,
      };
    },
  };
};
