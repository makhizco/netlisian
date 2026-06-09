import { ComponentConfig, Field, Fields, WithId, WithPuckProps } from "@measured/puck";
import React from "react";
import isEqual from "react-fast-compare";
import { RepeatItem, RepeatProps } from "./Repeat";
import { getRepeatComponentRegistry } from "./registry";

export type RepeatRenderProps = WithId<WithPuckProps<RepeatProps>> & {
  _map?: unknown;
};
export type ComponentRegistry = Record<string, ComponentConfig<Record<string, unknown>>>;

const FALLBACK_CATEGORY = "Other Components";

export const getComponentRegistry = (): ComponentRegistry => {
  return getRepeatComponentRegistry() as ComponentRegistry;
};

/**
 * Check if a component is ready to use (exists and has render function).
 * Prevents rendering issues when registry contains schema-only entries without render functions.
 */
export const isComponentReady = (
  comp: ComponentConfig<Record<string, unknown>> | undefined
): boolean => {
  return Boolean(comp && typeof comp.render === "function");
};

export const getComponentLabel = (key: string, comp?: ComponentConfig) =>
  typeof comp?.label === "string" && comp.label.trim() ? comp.label : key;

export const filterRepeatableFields = (fields: Fields = {}): Fields =>
  Object.fromEntries(
    Object.entries(fields).filter(
      ([k, v]) =>
        k !== "id" &&
        k !== "editMode" &&
        k !== "_map" &&
        k !== "_slotEnabled" &&
        v.type !== "slot" &&
        v.type !== "custom"
    )
  ) as Fields;

export const buildDefaultItemProps = (
  defaultProps: Record<string, unknown> = {},
  repeatableFields: Fields = {}
): RepeatItem | undefined => {
  const allowed = new Set(Object.keys(repeatableFields));
  const item = Object.fromEntries(
    Object.entries(defaultProps).filter(([key]) => allowed.has(key))
  );

  return Object.keys(item).length ? item : undefined;
};

export const stableGetItemSummary = (_item: RepeatItem, index?: number): string =>
  `Item ${(index || 0) + 1}`;

export const createItemsField = (
  arrayFields: Fields = {},
  defaultItemProps?: RepeatItem
): NonNullable<Fields<RepeatProps>["items"]> => {
  const field: NonNullable<Fields<RepeatProps>["items"]> = {
    type: "array",
    label: "Items",
    arrayFields,
    getItemSummary: stableGetItemSummary,
  };

  if (defaultItemProps) {
    field.defaultItemProps = defaultItemProps;
  }

  return field;
};

const RepeatItemView = React.memo(
  ({
    item,
    itemId,
    selectedComponent,
    parentProps,
    puck,
  }: {
    item: RepeatItem;
    itemId: string;
    selectedComponent: ComponentConfig<Record<string, unknown>>;
    parentProps: Record<string, unknown>;
    puck: RepeatRenderProps["puck"];
  }) => {
    const mergedProps = {
      ...parentProps,
      ...(selectedComponent.defaultProps || {}),
      ...item,
      puck: {
        ...puck,
        dragRef: null,
      },
      id: itemId,
    } as Parameters<typeof selectedComponent.render>[0];

    return <React.Fragment key={itemId}>{selectedComponent.render(mergedProps)}</React.Fragment>;
  },
  (prev, next) =>
    prev.itemId === next.itemId &&
    isEqual(prev.item, next.item) &&
    isEqual(prev.parentProps, next.parentProps)
);

export const RepeatContent = React.memo(
  (props: RepeatRenderProps) => {
    const { component: selectedKey, items, puck, id, ...parentProps } = props;
    const registry = getComponentRegistry();
    const isEditing = puck?.isEditing ?? false;

    // In non-edit mode, silently render nothing for unconfigured repeat or empty items
    if (!isEditing) {
      if (!selectedKey || !items?.length) {
        return null;
      }

      const selectedComponent = registry?.[selectedKey];
      if (!isComponentReady(selectedComponent)) {
        return null;
      }
    } else {
      // In edit mode, show helpful error messages
      if (!selectedKey || !items?.length) {
        return (
          <div className="grid gap-4 text-sm text-zinc-500">
            Select a valid component to render items.
          </div>
        );
      }

      const selectedComponent = registry?.[selectedKey];
      if (!isComponentReady(selectedComponent)) {
        return (
          <div className="grid gap-4 text-sm text-zinc-500">
            Select a valid component to render items.
          </div>
        );
      }
    }

    const selectedComponent = registry?.[selectedKey];

    const childFields = (selectedComponent.fields || {}) as Fields;
    const hasSlots = Object.values(childFields).some(
      (fieldConfig) => fieldConfig.type === "slot"
    );

    if (hasSlots) {
      return (
        <div className="grid gap-4 rounded-md border border-dashed border-red-500 bg-red-50 p-4 text-sm text-red-500">
          <strong>Configuration Error:</strong> Components with slots enabled are
          not allowed in the Repeat component. Please select a simpler component.
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {items.map((item: RepeatItem, index: number) => {
          const itemId: string = (item.id as string) || `${id}-${selectedKey}-${index}`;

          return (
            <RepeatItemView
              key={itemId}
              item={item}
              itemId={itemId}
              selectedComponent={selectedComponent}
              parentProps={parentProps}
              puck={puck}
            />
          );
        })}
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.component === nextProps.component &&
    isEqual(prevProps.items, nextProps.items) &&
    isEqual(prevProps._map, nextProps._map)
);

export const filterClasses = (rawClasses: string) => {
  const blocklist = [
    /^(?:[a-z0-9-]+:)?m[xytrbl]?-/,
    /^(?:[a-z0-9-]+:)?p[xytrbl]?-/,
    /^(?:[a-z0-9-]+:)?w-/,
    /^(?:[a-z0-9-]+:)?h-/,
    /^(?:[a-z0-9-]+:)?max-/,
    /^(?:[a-z0-9-]+:)?min-/,
    /^(?:[a-z0-9-]+:)?gap-/,
    /^(?:[a-z0-9-]+:)?inset-/,
    /^(?:[a-z0-9-]+:)?(top|bottom|left|right)-/,
    /^(?:[a-z0-9-]+:)?z-/,
    /^(?:[a-z0-9-]+:)?flex-(?:1|auto|none|grow|shrink)/,
    /^(?:[a-z0-9-]+:)?col-span-/,
  ];

  return rawClasses
    .split(" ")
    .filter((c) => {
      if (c.startsWith("_Drop")) return false;
      return !blocklist.some((regex) => regex.test(c));
    })
    .map((c) => {
      const gridMatch = c.match(/^(?:([a-z0-9-]+):)?grid-cols-(\d+)$/);
      if (gridMatch) {
        const [, prefix, cols] = gridMatch;
        const colSpan = prefix ? `${prefix}:col-span-${cols}` : `col-span-${cols}`;
        return `${c} ${colSpan}`;
      }
      return c;
    })
    .join(" ");
};

export const getFallbackCategory = () => FALLBACK_CATEGORY;
