import { SoftRender } from "../components/soft-render";
import { useEffect } from "react";
import { SoftComponent, SoftComponents } from "../types/SoftComponent";
import { ComponentConfig, Config, DefaultComponentProps } from "@measured/puck";

export const createVersionedComponentConfig = (
  componentName: string,
  version: string,
  allVersions: string[],
  config: Config,
  softComponents: SoftComponents,
  defaultProps: DefaultComponentProps
): ComponentConfig => {
  const softConfig = config;
  return {
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

      const fieldsWithoutSlots = Object.fromEntries(
        Object.entries(versionedComponent?.fields || {})
          .filter(([, field]) => field.type !== "slot")
          .map(([key, field]) => [key, { ...field }])
      );

      return {
        version: {
          label: "Version",
          type: "select",
          options: allVersions.map((v) => ({ label: v, value: v })),
        },
        ...fieldsWithoutSlots,
      };
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
