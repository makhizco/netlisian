"use client";
import { AutoField, Field, Fields } from "@puckeditor/core";
import {
  buildArrayDefaultItemProps,
  getArrayItemSummary,
  isPrimitiveFieldType,
} from "./array-field-utils";
import {
  getCustomFieldTypeOptions,
  resolveCustomFieldDefinition,
  resolveCustomFieldReturnType,
  resolveCustomFieldSchema,
} from "./custom-fields";
import type {
  CustomFields,
  SoftFieldDefinition,
  SoftFieldSettings,
} from "../types/SoftFields";

const buildPuckField = (
  field: SoftFieldDefinition,
  fieldSettings?: SoftFieldSettings[string],
  customFields?: CustomFields,
): Field => {
  const customFieldDefinition = resolveCustomFieldDefinition(
    field.type,
    customFields,
  );
  const customReturnType = resolveCustomFieldReturnType(
    field.type,
    customFields,
  );

  if (customFieldDefinition && customReturnType) {
    return {
      ...customFieldDefinition.field,
      type: "custom",
      label: customFieldDefinition.field.label || field.name,
    } as Field;
  }

  const resolvedType = field.type;

  switch (resolvedType) {
    case "text":
    case "textarea":
      return { type: resolvedType, label: field.name };
    case "number":
      return {
        type: resolvedType,
        label: field.name,
        min: fieldSettings?.min,
        max: fieldSettings?.max,
        step: fieldSettings?.step,
      };
    case "select":
    case "radio":
      return {
        type: resolvedType,
        label: field.name,
        options: fieldSettings?.options || [],
      };
    case "array": {
      const subFields = fieldSettings?.subFields || [];
      const subFieldSettings = fieldSettings?.subFieldSettings || {};

      return {
        type: "array",
        label: field.name,
        min: fieldSettings?.min,
        max: fieldSettings?.max,
        arrayFields: buildDefaultEditorFields(
          subFields,
          subFieldSettings,
          customFields,
        ),
        defaultItemProps: buildArrayDefaultItemProps(
          subFields,
          subFieldSettings,
        ),
        getItemSummary(item, index) {
          return getArrayItemSummary(item, index, fieldSettings);
        },
      };
    }
    case "object":
      return {
        type: "object",
        label: field.name,
        objectFields: buildDefaultEditorFields(
          fieldSettings?.subFields || [],
          fieldSettings?.subFieldSettings || {},
          customFields,
        ),
      };
    default:
      return { type: "text", label: field.name };
  }
};

const buildDefaultEditorFields = (
  fields: SoftFieldDefinition[] = [],
  fieldSettings: SoftFieldSettings = {},
  customFields?: CustomFields,
): Fields => {
  return fields.reduce((acc, field) => {
    acc[field.name] = buildPuckField(
      field,
      fieldSettings[field.name],
      customFields,
    );
    return acc;
  }, {} as Fields);
};

const getFieldSettings = (
  _fields?: SoftFieldDefinition[],
  _fieldSettings?: SoftFieldSettings,
  customFields?: CustomFields,
  deep?: boolean,
): Fields => {
  const customTypeOptions = getCustomFieldTypeOptions(customFields);

  return (_fields || []).reduce((fields, field) => {
    const fieldSettings: Fields = {
      // placeholder: { type: "text", label: "Placeholder" },
    };

    const currentFieldSettings = _fieldSettings?.[field.name];
    const customFieldDefinition = resolveCustomFieldDefinition(
      field.type,
      customFields,
    );
    const customReturnType = resolveCustomFieldReturnType(
      field.type,
      customFields,
    );
    const resolvedType = field.type;
    const customSchema = resolveCustomFieldSchema(field.type, customFields);
    const resolvedSubFields =
      customSchema?.subFields || currentFieldSettings?.subFields || [];
    const resolvedSubFieldSettings =
      customSchema?.subFieldSettings ||
      currentFieldSettings?.subFieldSettings ||
      {};
    const customDefaultValueField =
      customFieldDefinition && customReturnType
        ? ({
            ...customFieldDefinition.field,
            type: "custom",
            label: customFieldDefinition.field.label || "Default Value",
          } as Field)
        : null;

    if (customDefaultValueField) {
      fieldSettings.defaultValue = customDefaultValueField;
    }

    switch (resolvedType) {
      case "text":
      case "textarea":
        if (!customDefaultValueField) {
          fieldSettings.defaultValue = {
            type: resolvedType,
            label: "Default Value",
          };
        }
        break;

      case "number":
        if (!customDefaultValueField) {
          fieldSettings.defaultValue = {
            type: resolvedType,
            label: "Default Value",
          };
        }
        fieldSettings.min = {
          type: resolvedType,
          label: "Minimum Value",
        };
        fieldSettings.max = {
          type: resolvedType,
          label: "Maximum Value",
        };
        fieldSettings.step = {
          type: resolvedType,
          label: "Step Size",
        };
        break;
      case "radio":
      case "select": {
        const selectOptions = currentFieldSettings?.options || [];

        if (!customDefaultValueField) {
          fieldSettings.defaultValue = {
            type: "custom",
            label: "Default Value",
            render: ({ value, onChange, id }) => (
              <AutoField
                field={{
                  type: resolvedType as "select" | "radio",
                  label: "Default Value",
                  options: selectOptions,
                }}
                value={value}
                onChange={onChange}
                readOnly={false}
                id={id}
              />
            ),
          };
        }

        fieldSettings.options = {
          type: "array",
          label: "Options",
          defaultItemProps: {
            label: "New Option",
            value: "new",
          },
          arrayFields: {
            label: { type: "text", label: "Label" },
            value: {
              type: "text",
              label: "Value",
            },
          },
          getItemSummary(item, index) {
            return item.label || `Option ${(index || 0) + 1}`;
          },
        };

        break;
      }
      case "array":
      case "object":
        fieldSettings.subFields = {
          type: "array",
          label: "Sub Fields",
          defaultItemProps: {
            name: "New Sub Field",
            type: "text",
          },
          arrayFields: {
            name: { type: "text", label: "Name" },
            type: {
              type: "select",
              options: deep
                ? [
                    {
                      label: "Text",
                      value: "text",
                    },
                    {
                      label: "Number",
                      value: "number",
                    },
                    {
                      label: "Select",
                      value: "select",
                    },
                    {
                      label: "Radio",
                      value: "radio",
                    },
                    ...customTypeOptions,
                  ]
                : [
                    {
                      label: "Text",
                      value: "text",
                    },
                    {
                      label: "Number",
                      value: "number",
                    },
                    {
                      label: "Select",
                      value: "select",
                    },
                    {
                      label: "Radio",
                      value: "radio",
                    },
                    {
                      label: "Array",
                      value: "array",
                    },
                    {
                      label: "Object",
                      value: "object",
                    },
                    {
                      label: "Reference",
                      value: "reference",
                    },
                    ...customTypeOptions,
                  ],
            },
          },
          getItemSummary(item, index) {
            return item.name || `Field ${(index || 0) + 1}`;
          },
        };

        if (!deep)
          fieldSettings.subFieldSettings = {
            type: "object",
            label: "Sub Field Settings",
            objectFields: resolvedSubFields
              ? getFieldSettings(
                  resolvedSubFields,
                  resolvedSubFieldSettings,
                  customFields,
                  true,
                )
              : {},
          };

        if (resolvedType === "array") {
          if (!customDefaultValueField) {
            fieldSettings.defaultValue = {
              type: "array",
              label: "Default Items",
              arrayFields: buildDefaultEditorFields(
                resolvedSubFields,
                resolvedSubFieldSettings,
                customFields,
              ),
              defaultItemProps: buildArrayDefaultItemProps(
                resolvedSubFields,
                resolvedSubFieldSettings,
              ),
              getItemSummary(item, index) {
                return getArrayItemSummary(item, index, currentFieldSettings);
              },
            };
          }

          fieldSettings.min = {
            type: "number",
            label: "Minimum Items",
          };
          fieldSettings.max = {
            type: "number",
            label: "Maximum Items",
          };
          fieldSettings.summary = {
            type: "select",
            label: "Summary",
            options: [
              {
                label: "Default Numbering / Count",
                value: "count",
              },
              {
                label: "Field",
                value: "field",
              },
              {
                label: "Expression",
                value: "expression",
              },
            ],
          };

          if (currentFieldSettings?.summary === "field") {
            fieldSettings.summaryField = {
              type: "select",
              label: "Summary Field",
              options: [
                {
                  label: "Select a field",
                  value: "",
                },
                ...resolvedSubFields
                  .filter((subField) => isPrimitiveFieldType(subField.type))
                  .map((subField) => ({
                    label: subField.name,
                    value: subField.name,
                  })),
              ],
            };
          }

          if (currentFieldSettings?.summary === "expression") {
            fieldSettings.summaryExpression = {
              type: "text",
              label: "Summary Expression",
            };
          }
        }
        break;
    }

    const overriddenFieldSettings = customFieldDefinition?.fieldSettingsOverride
      ? customFieldDefinition.fieldSettingsOverride({
          fieldName: field.name,
          fieldType: field.type,
          fieldSettings: currentFieldSettings,
          originalFieldSettings: fieldSettings,
        })
      : fieldSettings;

    fields[field.name] = {
      type: "object",
      label: field.name,
      objectFields: overriddenFieldSettings,
    };

    return fields;
  }, {} as Fields);
};
export default getFieldSettings;
