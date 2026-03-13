import { SoftRender } from "../components/soft-render";
import { SoftComponents } from "../types/SoftComponent";
import { ComponentConfig, Config, DefaultComponentProps, Field } from "@measured/puck";

export const createVersionedComponentConfig = (
  componentName: string,
  displayName: string,
  version: string,
  allVersions: string[],
  config: Config,
  softComponents: SoftComponents,
  defaultProps: DefaultComponentProps,
  showVersioning = true
): ComponentConfig => {
  const softConfig = config;
  return {
    label: displayName,
    fields: Object.fromEntries(
      (
        Object.entries(
          softComponents[componentName].versions?.[version]?.fields
        ) || [] // BUG: Issue not version dependent as has no co-relation with data. Refresh page or make custom implementation for slot.
      ).filter(
        ([key, field]) => field.type === "slot"
      ).map(([key, field]) => [key, { ...field }])
    ),
    defaultProps: {
      ...defaultProps,
      version,
    },
    resolveFields: (data) => {
      const selectedVersion = (data.props as any)?.version || version;

      const versionedComponent =
        softComponents[componentName]?.versions[selectedVersion];

      let fields: Record<string, Field> = {};

      if (showVersioning) {
        fields.version = {
          label: "Version",
          type: "select",
          options: allVersions.map((v) => ({ label: v, value: v })),
        }
      }

      Object.entries(versionedComponent?.fields || {})
        .filter(([, field]) => field.type !== "slot")
        .forEach(([key, field]) => {
          fields[key] = field;
        })


      return fields;
    },
    render: (props) => {
      const selectedVersion = (props as any).version || version;
      const versionedComponent =
        softComponents[componentName]?.versions[selectedVersion];

      return (
        <SoftRender
          softComponentFields={versionedComponent.fields}
          softComponentFieldSettings={versionedComponent.fieldSettings}
          softSubComponent={versionedComponent.components}
          configComponents={softConfig.components}
          props={props}
        />
      );
    },
  };
};
