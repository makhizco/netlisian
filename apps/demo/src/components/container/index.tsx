import { ComponentConfig, Field, PuckContext } from "@puckeditor/core";
import { ContainerElement, containerElements } from "./container-elements";
import { ContainerProps } from "./Container";
import { LeafElement, leafElements } from "./leaf-elements";
import { buildAttributeValueField } from "./build-attribute-value-fields";
import React from "react";
import { attributesConstructor } from "./attributes-constructor";
import { Box } from "lucide-react";
import { Attribute, AttributeValue } from "./base";
import { renderAdmin } from "./render-admin";
import { renderPreview } from "./render-preview";
export const Container: ComponentConfig<ContainerProps> = {
  label: "Container",
  defaultProps: {
    element: "div",
    slotItem: [],
    attributes: [{ key: "className", valueType: "string" }],
  },

  inline: true,
  fields: {
    element: {
      type: "select",
      label: "Element",
      options: [...containerElements, ...leafElements]
        .sort((a, b) => a.localeCompare(b))
        .map((el) => ({
          label: el.toUpperCase(),
          value: el,
        })),
    },
    attributes: {
      type: "array",
      defaultItemProps: {
        key: "className",
        valueType: "string",
      },
      getItemSummary(item: { key: string; valueType: string }) {
        return `${item.key}: ${item.valueType}`;
      },
      arrayFields: {
        key: { type: "text", label: "Attribute Name" }, // fixed typo
        valueType: {
          type: "select",
          label: "Attribute Type",
          options: [
            { label: "Text", value: "string" },
            { label: "Number", value: "number" },
            { label: "Boolean", value: "boolean" },
            { label: "Key/Value", value: "key-value" },
            // { label: "Function", value: "function" },
          ],
        },
      },
    },
    values: {
      type: "object",
      label: "Attribute Values",
      objectFields: {},
    },
    noChild: {
      type: "radio",
      label: "No Child Content",
      options: [
        { label: "False", value: false },
        { label: "True", value: true },
      ],
    },
    slot: {
      type: "object",
      label: "Container Settings",
      objectFields: {
        allow: {
          type: "array",
          label: "Allowed Elements",
          arrayFields: {
            element: { type: "text", label: "Element" },
          },
        },
        disallow: {
          type: "array",
          label: "Disallowed Elements",
          arrayFields: {
            element: { type: "text", label: "Element" },
          },
        },
        className: {
          type: "text",
          label: "Slot Class",
          placeholder: "text-center, p-4",
        },
        style: {
          type: "array",
          label: "Slot Style",
          arrayFields: {
            key: { type: "text", label: "Key" },
            value: { type: "text", label: "Value" },
          },
        },
      },
    },
    slotItem: {
      type: "slot",
    },
  },
  resolveFields: ({ props }, { fields, changed }) => {
    if (changed.attributes || changed.values || !fields.values) {
      fields.values = {
        type: "object",
        label: "Attribute Values",
        objectFields: (props.attributes ?? []).reduce(
          (
            acc: {
              [key: string]: Field<AttributeValue[number]>;
            },
            {
              key,
              valueType,
            }: {
              key: string;
              valueType:
                | "string"
                | "number"
                | "boolean"
                | "key-value"
                | "object"
                | "function";
            },
          ) => {
            if (!key) return acc;
            const field = buildAttributeValueField(key, valueType);
            if (field !== undefined) {
              acc[key] = field as Field<AttributeValue[number]>;
            }
            return acc;
          },
          {},
        ),
      };
      return fields;
    }
    return fields;
  },
  render: ({
    puck,
    element,
    attributes,
    values,
    slot,
    slotItem: Item,
    noChild,
  }: {
    puck: PuckContext;
    element: ContainerElement | LeafElement;
    attributes?: Array<{ key: string; valueType: string }>;
    values?: Record<string, unknown>;
    noChild?: boolean;
    slot?: {
      allow?: Array<{ element: string }> | string[];
      disallow?: Array<{ element: string }> | string[];
      className?: string;
      style?: Array<{ key: string; value: string }>;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slotItem?: React.ComponentType<any>;
  }) => {
    // Memoize the attributes construction to prevent new object references
    const { className, style, ...props } = React.useMemo(
      () =>
        attributesConstructor(
          (attributes ?? []) as Array<Attribute>,
          (values ?? {}) as AttributeValue,
        ),
      [attributes, values],
    );

    // if (puck.isEditing) {
    //   return renderAdmin({
    //     puck,
    //     element,
    //     props,
    //     className,
    //     style,
    //     noChild,
    //     slot,
    //     Item,
    //   });
    // }

    return renderPreview({
      puck,
      element,
      props,
      className,
      style,
      noChild,
      slot,
      Item,
    });
  },
};
