import { Field, Fields, AutoField } from "@measured/puck";
import { Attribute, AttributeValue } from "../types/BaseFields";

export const buildAttributeValueField = (
  key: string,
  valueType: Attribute["valueType"]
) => {
  switch (valueType) {
    case "string":
      return { type: "textarea", label: key } as Field<string>;
    case "number":
      return { type: "number", label: key } as Field<number>;
    case "boolean":
    return {
      type: "radio",
      options: [
        { label: "True", value: true },
        { label: "False", value: false },
      ],
    };  
    return {
        type: "custom",
        label: key,
        render: ({ onChange, value, id }) => {
          return (
            <AutoField
              field={{
                type: "radio",
                options: [
                  { label: "True", value: true },
                  { label: "False", value: false },
                ],
              }}
              value={value}
              onChange={(newValue) => onChange(newValue)}
            />
          );
        },
      } as Field<boolean>;
    case "key-value":
      return {
        type: "array",
        label: key,
        arrayFields: {
          key: { type: "text", label: "Key" },
          value: { type: "text", label: "Value" },
        },
        defaultItemProps: {
          key: "",
          value: "",
        },
        getItemSummary: (item: {
          key: string;
          value: string;
        }) => `${item.key}: ${item.value}`,
      };
    case "function":
      return { type: "text", label: `${key} Function name` } as Field<string>;
    default:
      return undefined;
  }
};
