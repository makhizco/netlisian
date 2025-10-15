import { ComponentConfig, Field } from "@measured/puck";
import { containerElements } from "./container-elements";
import { ContainerProps } from "./Container";
import { leafElements } from "./leaf-elements";
import { buildAttributeValueField } from "./build-attribute-value-fields";
import { isLeafElement } from "./is-leaf-element";
import React, { ElementType } from "react";
import { attributesConstructor } from "./attributes-constructer";

export const Container: ComponentConfig<ContainerProps> = {
  label: "Container",
  defaultProps: {
    element: "div",
    slotItem: [],
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
      getItemSummary(item) {
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
    if (
      changed.attributes ||
      changed.values ||
      !fields.values
    ) {
      fields.values = {
        type: "object",
        label: "Attribute Values",
        objectFields: (props.attributes ?? []).reduce(
          (
            acc: Record<string, Field>,
            { key, valueType }: { key: string; valueType: string }
          ) => {
            if (!key) return acc;
            const field = buildAttributeValueField(key, valueType);
            if (field !== undefined) {
              acc[key] = field as Field;
            }
            return acc;
          },
          {}
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
  }: {
    puck: any;
    element: string | ElementType;
    attributes?: Array<{ key: string; valueType: string }>;
    values?: Record<string, unknown>;
    slot?: {
      allow?: Array<{ element: string }>;
      disallow?: Array<{ element: string }>;
      className?: string;
      style?: Array<{ key: string; value: string }>;
    };
    slotItem?: React.ComponentType<any>;
  }) => {
    const Component = element!;
    const { className, style, ...props } = attributesConstructor(
      (attributes ?? []) as Array<{ key: string; valueType: string }>,
      (values ?? {}) as Record<string, unknown>
    );

    if (isLeafElement(element as string)) {
      return React.createElement(Component, {
        ref: puck.dragRef,
        ...props,
        className,
        style,
      });
    } else {
      // fallback for Item if undefined
      const SlotItem = Item ?? (() => null);
      return React.createElement(
        Component,
        {
          ref: puck.dragRef,
          ...props,
          className: puck.isEditing ? undefined : className,
          style: puck.isEditing ? undefined : style,
        },
        <SlotItem
          allow={slot?.allow?.length ? slot?.allow : undefined}
          disallow={slot?.disallow?.length ? slot?.disallow : undefined}
          className={[className, slot?.className].filter(Boolean).join(" ")}
          style={{
            ...style,
            ...(slot?.style?.length
              ? Object.assign(
                {},
                ...((slot?.style ?? []).map((s) => ({ [s.key]: s.value })))
              )
              : {}),
          }}
        />
      );
    }
  },
};
