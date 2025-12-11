import {
  AutoField,
  Config,
  createUsePuck,
  Field,
  Label,
  RootConfig,
  walkTree,
} from "@measured/puck";
import { BuilderRootConfig } from "../../types/BuilderConfig";
import getFieldSettings from "../get-field-settings";
import { getFieldSettingsByPath } from "../get-settings-by-path";
import { setPropertyByPath } from "../set-prop-by-path";
import { useEffect, useState } from "react";
import { useSoftConfig } from "../../context/useStore";
import { confirm } from "../confirm";
import { AppStore } from "../../store";

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

export const builderRootConfig = (
  config: Config,
  overrides: AppStore["overrides"],
  editingComponent?: string
): RootConfig<BuilderRootConfig> => ({
  fields: {
    _name: {
      type: "text",
      label: "Soft Component Name",
    },
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
    },
  },
  resolveFields({ props: data }, { fields, changed }) {
    if (!data?._fields || changed._fields || changed._fieldSettings)
      if (data?._fields?.length)
        fields._fieldSettings = {
          type: "object",
          label: "Field Settings",
          objectFields: getFieldSettings(
            data!._fields || [],
            data!._fieldSettings || {}
          ),
        };
      else delete fields._fieldSettings;

    if (
      data?._versions?.length &&
      (!data?._version || changed._version || changed._fieldSettings)
    ) {
      const latestVersion =
        data._versions[data._versions.length - 1] || "1.0.0";

      delete fields._version;
      fields._version = {
        type: "select",
        label: "Version",
        options: [
          ...data._versions.map((v) => ({ label: v, value: v })),
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
      } as Field<string | undefined>;
    }

    return fields;
  },
  resolveData: (props) => {
    return {
      props,
      readOnly: Boolean(editingComponent)
        ? {
            _name: true,
          }
        : undefined,
    };
  },
  render: (props) => {
    const fieldSettings = props?._fieldSettings;
    const data = useCustomPuck((s) => s.appState.data);
    const dispatch = useCustomPuck((s) => s.dispatch);
    const getSelectorForId = useCustomPuck((s) => s.getSelectorForId);
    const setVersion = useSoftConfig((s) => s.builder.setVersion);
    const state = useSoftConfig((s) => s.state);
    useEffect(() => {
      const propagateChanges = setTimeout(() => {
        if (!fieldSettings || Object.keys(fieldSettings).length === 0) return;

        walkTree(
          data,
          {
            components: config.components,
          },
          (content) =>
            content.map((child) => {
              const map: {
                from?: string | string[];
                to?: string | string[];
                transform?: (values: any[], props: any) => any;
              }[] = child.props?._map || [];
              if (map.length) {
                map.forEach(({ from, to, transform }) => {
                  if (!from || !to) return;

                  const fromPaths = Array.isArray(from) ? from : [from];
                  const toPaths = Array.isArray(to) ? to : [to];

                  const inputValues = fromPaths.map((f) =>
                    getFieldSettingsByPath(props._fieldSettings || {}, f)
                  );

                  // Apply transform if provided, otherwise use first input value
                  let value = transform
                    ? transform(
                        inputValues.map((v) => v?.defaultValue),
                        child.props
                      )
                    : inputValues[0];

                  // Handle array result - map to multiple toPaths
                  if (Array.isArray(value)) {
                    value.forEach((val, i) => {
                      if (toPaths[i]) {
                        const originalValue = getFieldSettingsByPath(
                          child.props,
                          toPaths[i]
                        );
                        if (originalValue !== val) {
                          const itemSelector = getSelectorForId(child.props.id);
                          if (!itemSelector) return;
                          setPropertyByPath(child.props, toPaths[i], val);
                          dispatch({
                            type: "replace",
                            data: child,
                            destinationIndex: itemSelector?.index,
                            destinationZone: itemSelector?.zone,
                          });
                        }
                      }
                    });
                  } else if (toPaths[0]) {
                    // Handle single value - map to first toPath
                    const setting = getFieldSettingsByPath(
                      fieldSettings,
                      fromPaths.length === 1
                        ? fromPaths[0]
                        : fromPaths.join(".")
                    );
                    const defaultValue = setting?.defaultValue;
                    const originalValue = getFieldSettingsByPath(
                      child.props,
                      toPaths[0]
                    );

                    // Prefer transform result if transform was provided and produced a value,
                    // otherwise fall back to configured defaultValue, otherwise use computed value
                    const finalValue =
                      transform !== undefined && value !== undefined
                        ? value
                        : defaultValue !== undefined
                          ? defaultValue
                          : value;

                    if (originalValue !== finalValue) {
                      const itemSelector = getSelectorForId(child.props.id);
                      if (!itemSelector) return;
                      setPropertyByPath(child.props, toPaths[0], finalValue);
                      dispatch({
                        type: "replace",
                        data: child,
                        destinationIndex: itemSelector?.index,
                        destinationZone: itemSelector?.zone,
                      });
                    }
                  }
                });
              }
              return child;
            })
        );
      }, 300);

      return () => clearTimeout(propagateChanges);
    }, [fieldSettings]);

    useEffect(() => {
      if (state !== "remodeling") return;
      if (!props?._version || !props?._name) return;

      const currentVersion = props?._version;

      // Check if this is switching to an existing version (not a version bump)
      if (
        props._versions?.includes(currentVersion) &&
        props._versions.length > 1
      ) {
        // This is an existing version switch, update the component structure
        setVersion(props._name, currentVersion, props, dispatch);
      }
    }, [props?._version]);

    return <>{props.children}</>;
  },
});
