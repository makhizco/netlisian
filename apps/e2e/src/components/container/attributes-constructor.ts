import { Attribute, AttributeValue } from "./base";

export const attributesConstructor = (
  properties: Attribute[],
  values: AttributeValue
) =>
  properties.reduce(
    (acc, { key, valueType }) => {
      const value = values?.[key];

      if (valueType === "function") {
        // TODO: Handle function type
      } else if (valueType === "key-value" || valueType === "object") {
        let parsedValue;
        try {
          parsedValue = JSON.parse(JSON.stringify(value as string));
        } catch (e) {
          parsedValue = [];
        }
        acc[key] = (
          parsedValue as {
            key: string;
            value: string;
          }[]
        ).reduce((obj: { [key: string]: string }, { key, value }) => {
          obj[key] = value;
          return obj;
        }, {});
      } else {
        acc[key] = value;
      }

      return acc;
    },
    {} as { [key: string]: string | number | boolean | { [key: string]: string } | undefined }
  );
