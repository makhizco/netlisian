import React from "react";
import { Attribute, AttributeValue } from "../types/BaseFields";

export const attributesConstructor = (
  properties: Attribute[],
  values: AttributeValue
) =>
  properties.reduce(
    (acc, { key, valueType }) => {
      const value = values?.[key];

      if (valueType === "function") {
        // TODO: Handle function type
      } else if (valueType === "key-value") {
        let parsedValue;
        try {
          parsedValue = JSON.parse(JSON.stringify(value as string));
        } catch (e) {
          console.log("Failed to parse JSON value:", e);
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
    {} as { [key: string]: any }
  );
