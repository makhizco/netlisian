import { SoftRender } from "../components/soft-render";
import { SoftComponents } from "../types/SoftComponent";
import {
  ComponentConfig,
  Config,
  DefaultComponentProps,
  Field,
} from "@puckeditor/core";
import type { CustomFields } from "../types/SoftFields";
import type { Overrides } from "../types/Overrides";

const hydrateCustomField = (
  fieldName: string,
  field: Field,
  fieldSettings: Record<string, unknown> | undefined,
  customFields?: CustomFields,
): Field => {
  if (field.type !== "custom") {
    return field;
  }

  const fieldWithMeta = field as Field & {
    customFieldType?: string;
  };

  const customFieldType =
    fieldWithMeta.customFieldType ||
    (fieldSettings?.[fieldName] as { customFieldType?: string } | undefined)
      ?.customFieldType;

  if (!customFieldType) {
    return field;
  }

  const customField = customFields?.[customFieldType];
  if (!customField) {
    return field;
  }

  return {
    ...field,
    ...customField.field,
    type: "custom",
    label: field.label || customField.field.label || fieldName,
  } as Field;
};

export const createVersionedComponentConfig = (
  componentName: string,
  displayName: string,
  version: string,
  allVersions: string[],
  config: Config,
  softComponents: SoftComponents,
  defaultProps: DefaultComponentProps,
  showVersioning = true,
  customFields?: CustomFields,
  overrides?: Overrides,
): ComponentConfig => ({
  label: displayName,
  fields: Object.fromEntries(
    (
      Object.entries(
        softComponents[componentName].versions?.[version]?.fields,
      ) || []
    )
      .filter(([key, field]) => field.type === "slot")
      .map(([key, field]) => [key, { ...field }]),
  ),
  defaultProps: {
    ...defaultProps,
    version,
  },
  resolveFields: (data) => {
    const selectedVersion =
      ((data.props as Record<string, unknown> | undefined)?.version as
        | string
        | undefined) || version;

    const versionedComponent =
      softComponents[componentName]?.versions[selectedVersion];

    let fields: Record<string, Field> = {};

    if (showVersioning) {
      fields.version = {
        label: "Version",
        type: "select",
        options: allVersions.map((v) => ({ label: v, value: v })),
      };
    }

    Object.entries(versionedComponent?.fields || {})
      .filter(([, field]) => field.type !== "slot")
      .forEach(([key, field]) => {
        fields[key] = hydrateCustomField(
          key,
          field,
          versionedComponent?.fieldSettings,
          customFields,
        );
      });

    return fields;
  },
  render: (props) => {
    const selectedVersion =
      ((props as Record<string, unknown>).version as string | undefined) ||
      version;
    const versionedComponent =
      softComponents[componentName]?.versions[selectedVersion];

    return (
      <SoftRender
        softComponentFields={versionedComponent.fields}
        softComponentFieldSettings={versionedComponent.fieldSettings}
        softSubComponent={versionedComponent.components}
        configComponents={config.components}
        props={props}
      />
    );
  },
});
