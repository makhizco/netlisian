"use client";

import { Field, AutoField } from "@puckeditor/core";
import { Attribute } from "./base";

export const buildAttributeValueField = (
  key: string,
  valueType: Attribute["valueType"],
):
  | Field<string>
  | Field<number>
  | Field<boolean>
  | Field<{ key: string; value: string }>
  | undefined => {
  switch (valueType) {
    case "string":
      return { type: "textarea", label: key } as Field<string>;
    case "number":
      return { type: "number", label: key } as Field<number>;
    case "boolean":
      return {
        type: "custom",
        label: key,
        render: ({ onChange, value }) => {
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
    case "object":
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
        } as any,
        getItemSummary: (item: { key: string; value: string }) =>
          `${item.key}: ${item.value}`,
      };
    case "function":
      return { type: "text", label: `${key} Function name` } as Field<string>;
    default:
      return undefined;
  }
};
