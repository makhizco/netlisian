import { AutoField, Field, Fields } from "@measured/puck";

export type FieldSettings = Record<
  string,
  {
    label: string;
    defaultValue?: any;
    min?: number;
    max?: number;
    step?: number;
    options?: { label: string; value: string }[];
    subFields?: { name: string; type: Field["type"] | "reference" }[];
    subFieldSettings?: FieldSettings;
  }
>;

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
        fieldSettings.summary = {
          type: "select",
          label: "Summary Field",
          options: [
            {
              label: "Default Numbering",
              value: "",
            },
            ...(currentFieldSettings?.subFields || []).map((f) => ({
              label: f.name,
              value: f.name,
            })),
          ],
        };
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
