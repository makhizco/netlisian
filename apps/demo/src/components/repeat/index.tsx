import { ComponentConfig, Fields } from "@puckeditor/core";
import React from "react";
import { RepeatProps } from "./Repeat";
import { ComponentPickerField, adminRender } from "./adminRender";
import {
  RepeatContent,
  buildDefaultItemProps,
  createItemsField,
  filterRepeatableFields,
  getComponentRegistry,
  isComponentReady,
} from "./shared";

export type { RepeatItem, RepeatProps } from "./Repeat";

type RepeatResolveFields = NonNullable<
  ComponentConfig<RepeatProps>["resolveFields"]
>;
type RepeatResolveParams = Parameters<RepeatResolveFields>[1];

const repeatComponentField: NonNullable<Fields<RepeatProps>["component"]> = {
  type: "custom",
  label: "Component",
  render: ({ value, onChange, id }) => (
    <ComponentPickerField value={value || ""} onChange={onChange} id={id} />
  ),
};

export const Repeat: ComponentConfig<RepeatProps> = {
  label: "Repeat",
  defaultProps: { component: "", items: [] },
  inline: true,
  fields: {
    component: repeatComponentField,
    items: createItemsField(),
  },
  async resolveFields({ props }, { fields, appState, changed, lastFields }) {
    const selectedKey =
      typeof props?.component === "string" ? props.component : "";
    const baseFields = fields as Fields<RepeatProps>;
    const componentChanged = Boolean(
      (changed as { component?: boolean }).component,
    );

    const registry = getComponentRegistry();
    const selectedComponent = selectedKey ? registry[selectedKey] : undefined;
    const isReady = isComponentReady(selectedComponent);

    // Reuse lastFields.items only if component hasn't changed and is ready
    if (!componentChanged && lastFields?.items && isReady) {
      return {
        ...baseFields,
        component: repeatComponentField,
        items: lastFields.items,
      };
    }

    if (!isReady) {
      return {
        ...baseFields,
        component: repeatComponentField,
        items: createItemsField(),
      };
    }

    // selectedComponent is guaranteed to exist and have render function at this point
    const readyComponent = selectedComponent!;

    const currentItems = Array.isArray(props?.items)
      ? (props.items as RepeatProps["items"])
      : [];
    const firstItem = {
      id: String(
        (currentItems[0]?.id as string | undefined) || "repeat-preview-item",
      ),
      ...((readyComponent.defaultProps as Record<string, unknown>) || {}),
      ...(currentItems[0] || {}),
    };

    let repeatableFields = filterRepeatableFields(
      (readyComponent.fields || {}) as Fields,
    );

    try {
      if (readyComponent.resolveFields) {
        const nestedChanged = componentChanged ? { component: true } : {};
        const resolved = await readyComponent.resolveFields(
          { props: firstItem },
          {
            appState,
            changed: nestedChanged as any,
            fields: (readyComponent.fields || {}) as Fields,
            lastFields: (readyComponent.fields || {}) as Fields,
            lastData: null,
            parent: null,
          },
        );
        repeatableFields = filterRepeatableFields((resolved || {}) as Fields);
      }
    } catch (error) {
      console.error("Failed to resolve repeat item fields:", error);
    }

    const defaultItemProps = buildDefaultItemProps(
      (readyComponent.defaultProps || {}) as Record<string, unknown>,
      repeatableFields,
    );

    return {
      ...baseFields,
      component: repeatComponentField,
      items: createItemsField(repeatableFields, defaultItemProps),
    };
  },
  // resolveData: () => {
  //   return {};
  // },
  render: (props) => {
    if (!props.puck.isEditing) {
      return <RepeatContent {...props} />;
    }

    return adminRender(props);
  },
};
