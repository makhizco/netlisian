import { AutoField, Field, Fields } from "@measured/puck";
import {
  buildArrayDefaultItemProps,
  getArrayItemSummary,
  isPrimitiveFieldType,
} from "./array-field-utils";
import type {
  FieldSettings,
  SoftFieldDefinition,
  SoftFieldSettings,
} from "../types/SoftFields";

const buildPuckField = (
  field: SoftFieldDefinition,
  fieldSettings?: SoftFieldSettings[string]
): Field => {
  switch (field.type) {
    case "text":
    case "textarea":
      return { type: field.type, label: field.name };
    case "number":
      return {
        type: field.type,
        label: field.name,
        min: fieldSettings?.min,
        max: fieldSettings?.max,
        step: fieldSettings?.step,
      };
    case "select":
    case "radio":
      return {
        type: field.type,
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
        arrayFields: buildDefaultEditorFields(subFields, subFieldSettings),
        defaultItemProps: buildArrayDefaultItemProps(subFields, subFieldSettings),
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
          fieldSettings?.subFieldSettings || {}
        ),
      };
    default:
      return { type: "text", label: field.name };
  }
};

const buildDefaultEditorFields = (
  fields: SoftFieldDefinition[] = [],
  fieldSettings: SoftFieldSettings = {}
): Fields => {
  return fields.reduce((acc, field) => {
    acc[field.name] = buildPuckField(field, fieldSettings[field.name]);
    return acc;
  }, {} as Fields);
};

const getFieldSettings = (
  _fields?: {
    name: string;
    type: Field["type"] | "reference";
  }[],
  _fieldSettings?: FieldSettings,
  deep?: boolean
): Fields => {
  return (
    (_fields || []) as {
      name: string;
      type: Field["type"] | "reference";
      label: string;
    }[]
  ).reduce((fields, field) => {
    const fieldSettings: Fields = {
      // placeholder: { type: "text", label: "Placeholder" },
    };

    const currentFieldSettings = _fieldSettings?.[field.name];

    switch (field.type) {
      case "text":
      case "textarea":
        fieldSettings.defaultValue = {
          type: field.type,
          label: "Default Value",
        };
        break;

      case "number":
        fieldSettings.defaultValue = {
          type: field.type,
          label: "Default Value",
        };
        fieldSettings.min = {
          type: field.type,
          label: "Minimum Value",
        };
        fieldSettings.max = {
          type: field.type,
          label: "Maximum Value",
        };
        fieldSettings.step = {
          type: field.type,
          label: "Step Size",
        };
        break;
      case "radio":
      case "select":
        fieldSettings.defaultValue = {
          type: "custom",
          label: "Default Value",
          render: ({ value, onChange, id }) => (
            <AutoField
              field={{
                type: field.type as "select" | "radio",
                label: "Default Value",
                options: currentFieldSettings?.options || [],
              }}
              value={value}
              onChange={onChange}
              readOnly={false}
              id={id}
            />
          ),
        };
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
            objectFields: currentFieldSettings?.subFields
              ? getFieldSettings(
                  currentFieldSettings.subFields,
                  currentFieldSettings.subFieldSettings,
                  true
                )
              : {},
          };

        if (field.type === "array") {
          fieldSettings.defaultValue = {
            type: "array",
            label: "Default Items",
            arrayFields: buildDefaultEditorFields(
              currentFieldSettings?.subFields,
              currentFieldSettings?.subFieldSettings
            ),
            defaultItemProps: buildArrayDefaultItemProps(
              currentFieldSettings?.subFields,
              currentFieldSettings?.subFieldSettings
            ),
            getItemSummary(item, index) {
              return getArrayItemSummary(item, index, currentFieldSettings);
            },
          };

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
                ...(currentFieldSettings?.subFields || [])
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

    fields[field.name] = {
      type: "object",
      label: field.name,
      objectFields: fieldSettings,
    };

    return fields;
  }, {} as Fields);
};
export default getFieldSettings;
