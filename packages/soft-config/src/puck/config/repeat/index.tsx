import { ComponentConfig, Field } from "@measured/puck";
import { BuilderRootConfig } from "../../types/BuilderConfig";
import getFieldSettings from "../../lib/get-field-settings";

export const ConditionalView: ComponentConfig<{
  _fields: BuilderRootConfig["_fields"];
  _fieldSettings?: BuilderRootConfig["_fieldSettings"];
}> = {
  fields: {
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

    return fields;
  },
  defaultProps: {
    _fields: [],
  },
  render: ({}) => <></>,
};
