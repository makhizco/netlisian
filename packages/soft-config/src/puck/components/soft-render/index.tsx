import React, { useMemo, memo } from "react";
import equal from "react-fast-compare";
import { SoftComponent, SoftSubComponent } from "../../types/SoftComponent";
import { Config, WithId, WithPuckProps } from "@puckeditor/core";
import { applyMapping } from "../../lib/apply-mapping";
import { ErrorBoundary } from "../error-boundary";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (typeof val !== "object" || val === null) return false;
  if (React.isValidElement(val)) return false;
  if ("$$typeof" in val) return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

function cloneData<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "function") return value;
  if (Array.isArray(value))
    return (value as unknown[]).map(cloneData) as unknown as T;
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, cloneData(v)]),
  ) as T;
}

/**
 * Standard React shallow compare for props.
 *
 * Used instead of deep equality for `props` in memo comparators because `props`
 * can contain functions and React nodes — deep-comparing those risks retaining
 * stale closures across renders while adding unnecessary overhead.
 * Plain data fields (strings, numbers, booleans) are still compared correctly
 * since `Object.is` handles primitives exactly.
 */
function shallowEqual(objA: any, objB: any): boolean {
  if (Object.is(objA, objB)) return true;
  if (
    typeof objA !== "object" ||
    objA === null ||
    typeof objB !== "object" ||
    objB === null
  )
    return false;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (
      !Object.prototype.hasOwnProperty.call(objB, keysA[i]) ||
      !Object.is(objA[keysA[i]], objB[keysA[i]])
    ) {
      return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ComponentProps = WithId<WithPuckProps<Record<string, any>>>;

interface SharedRenderProps {
  softComponentFields: SoftComponent["fields"];
  softComponentFieldSettings?: Record<string, any>;
  configComponents: Config["components"];
  props: ComponentProps;
  depth?: number;
}

interface SubComponentRendererProps extends Required<SharedRenderProps> {
  subComponent: any;
  index: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SubComponentRenderer
// ─────────────────────────────────────────────────────────────────────────────

const SubComponentRenderer = memo(
  ({
    subComponent,
    softComponentFields,
    softComponentFieldSettings,
    configComponents,
    props,
    depth,
    index,
  }: SubComponentRendererProps) => {
    const { id, puck, editMode } = props;
    const componentConfig = configComponents[subComponent?.type];

    const stableId = useMemo(
      () =>
        depth === 0 ? id : `${subComponent.type}-${id}-d${depth}-i${index}`,
      [id, depth, subComponent.type, index],
    );

    const finalProps = useMemo(() => {
      if (!componentConfig) return {};

      const clonedProps = cloneData(subComponent.fixedProps || {});

      if (subComponent.map?.length) {
        const mergedInput = { ...clonedProps, ...props };
        const { newProps } = applyMapping(
          mergedInput,
          softComponentFieldSettings || {},
          subComponent.map,
          "propsFirst",
        );

        const parentKeys = new Set(Object.keys(props));
        for (const [key, value] of Object.entries(newProps)) {
          if (!parentKeys.has(key) || key in clonedProps) {
            clonedProps[key] = value;
          }
        }
      }

      Object.entries(componentConfig.fields || {}).forEach(
        ([slotKey, field]: [string, any]) => {
          if (field.type !== "slot") return;

          const enabledSlot = subComponent?.enabledSlots?.find(
            (s: any) => s.slot === slotKey,
          );

          if (enabledSlot) {
            const slotName =
              enabledSlot.name || `${subComponent.fixedProps?.id}-${slotKey}`;
            clonedProps[slotKey] = props[slotName] ?? (() => null);
          } else {
            clonedProps[slotKey] = ({
              className,
              style,
            }: {
              className?: string;
              style?: React.CSSProperties;
            }) => (
              <div className={className} style={style}>
                <SoftRender
                  softComponentFields={softComponentFields}
                  softComponentFieldSettings={softComponentFieldSettings}
                  softSubComponent={subComponent?.components?.[slotKey] ?? []}
                  configComponents={configComponents}
                  props={props}
                  depth={depth + 1}
                />
              </div>
            );
          }
        },
      );

      return clonedProps;
    }, [
      componentConfig,
      subComponent,
      props,
      softComponentFields,
      softComponentFieldSettings,
      configComponents,
      depth,
    ]);

    if (!componentConfig) return null;

    const ComponentRender = componentConfig.render;

    return (
      <ErrorBoundary>
        <ComponentRender
          id={stableId}
          editMode={editMode}
          puck={puck}
          {...finalProps}
        />
      </ErrorBoundary>
    );
  },
  (prev, next) =>
    prev.depth === next.depth &&
    prev.index === next.index &&
    prev.configComponents === next.configComponents &&
    prev.softComponentFields === next.softComponentFields &&
    // Shallow compare: props may contain functions/React nodes; deep equality
    // would risk retaining stale closures and is unnecessarily expensive here.
    shallowEqual(prev.props, next.props) &&
    // Deep compare: subComponent and fieldSettings are plain JSON configuration
    // objects with no functions, so structural equality is safe and correct.
    equal(prev.subComponent, next.subComponent) &&
    equal(prev.softComponentFieldSettings, next.softComponentFieldSettings),
);

SubComponentRenderer.displayName = "SubComponentRenderer";

// ─────────────────────────────────────────────────────────────────────────────
// SoftRender
// ─────────────────────────────────────────────────────────────────────────────

export const SoftRender = memo(
  ({
    softComponentFields,
    softComponentFieldSettings,
    softSubComponent,
    configComponents,
    props,
    depth = 0,
  }: SharedRenderProps & { softSubComponent: SoftSubComponent }) => {
    if (!softSubComponent?.length) return null;

    return (
      <>
        {softSubComponent.map((subComponent: any, index: number) => (
          <SubComponentRenderer
            key={`${subComponent?.type ?? "comp"}-${index}-${depth}`}
            subComponent={subComponent}
            softComponentFields={softComponentFields}
            softComponentFieldSettings={softComponentFieldSettings || {}}
            configComponents={configComponents}
            props={props}
            depth={depth}
            index={index}
          />
        ))}
      </>
    );
  },
  (prev, next) =>
    prev.configComponents === next.configComponents &&
    prev.softComponentFields === next.softComponentFields &&
    // Shallow compare: props may contain functions/React nodes; see shallowEqual.
    shallowEqual(prev.props, next.props) &&
    // Deep compare: softSubComponent and fieldSettings are plain JSON schemas.
    equal(prev.softSubComponent, next.softSubComponent) &&
    equal(prev.softComponentFieldSettings, next.softComponentFieldSettings),
);

SoftRender.displayName = "SoftRender";
