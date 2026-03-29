import React, { useMemo, memo } from "react";
import equal from "react-fast-compare";
import { SoftComponent, SoftSubComponent } from "../../types/SoftComponent";
import { Config, WithId, WithPuckProps } from "@measured/puck";
import { applyMapping } from "../../lib/apply-mapping";
import { ErrorBoundary } from "../error-boundary";

// ─────────────────────────────────────────────────────────────────────────────
// Safe deep clone
//
// Rules:
//   • Recursively clones plain objects and arrays.
//   • Preserves by reference: functions, React elements, class instances,
//     and anything else with a non-plain prototype (e.g. Radix refs, DOM
//     nodes, WeakMap keys). This is the correct alternative to JSON.parse/
//     stringify, which strips these and breaks Radix UI / Puck internals.
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
  if (Array.isArray(value)) return (value as unknown[]).map(cloneData) as unknown as T;
  if (!isPlainObject(value)) return value; // preserve class instances, refs, React elements
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, cloneData(v)])
  ) as T;
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
//
// Renders a single sub-component entry. Extracted from the map loop so that
// all hooks are called at the top level of a real component — fixing the
// "hooks inside .map()" Rules of Hooks violation in the previous iteration.
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
    // Destructure here — rest is derived from props so it doesn't need to be
    // a separate dep in useMemo; we access props[key] directly inside memos.
    const { id, puck, editMode } = props;

    const componentConfig = configComponents[subComponent?.type];

    // ── Hooks — ALL called unconditionally before any early returns ───────────

    /**
     * Deterministic stable ID.
     *
     * Includes `index` so siblings of the same type don't collide.
     * Avoids uuid() which produced a new value on every render, causing
     * child components to unmount and remount unnecessarily.
     */
    const stableId = useMemo(
      () =>
        depth === 0
          ? id
          : `${subComponent.type}-${id}-d${depth}-i${index}`,
      [id, depth, subComponent.type, index]
    );

    /**
     * Compute final resolved props in a single memo:
     *   1. Deep-clone fixedProps     (safe for Radix refs / functions)
     *   2. Apply field mappings      (transform must be pure — see note below)
     *   3. Wire slot render fns      (internal recursive or externally provided)
     *
     * Combining all three here prevents multiple intermediate object allocations
     * and ensures one coherent invalidation boundary.
     *
     * NOTE on transform purity:
     *   A transform that calls a state setter (e.g. props.onChange()) will fire
     *   during the render phase and trigger an infinite re-render loop.
     *   transforms MUST be pure — return a value, never cause side effects.
     */
    const finalProps = useMemo(() => {
      // Guard inside memo rather than before hooks — this keeps the hook call
      // count constant regardless of whether componentConfig is defined.
      if (!componentConfig) return {};

      const clonedProps = cloneData(subComponent.fixedProps || {});

      // ── Field mappings (via applyMapping for proper array-mapping support) ──
      // `from` paths reference the parent's props; `to` paths target the
      // sub-component's own props.  applyMapping uses a single object for
      // both resolution and assignment, so we merge them for the call.
      if (subComponent.map?.length) {
        const mergedInput = { ...clonedProps, ...props };
        const { newProps } = applyMapping(
          mergedInput,
          softComponentFieldSettings || {},
          subComponent.map,
          "propsFirst"
        );

        // Copy only the keys that belong to the sub-component back
        const parentKeys = new Set(Object.keys(props));
        for (const [key, value] of Object.entries(newProps)) {
          if (!parentKeys.has(key) || key in clonedProps) {
            clonedProps[key] = value;
          }
        }
      }

      // ── Slot wiring ─────────────────────────────────────────────────────────
      Object.entries(componentConfig.fields || {}).forEach(
        ([slotKey, field]: [string, any]) => {
          if (field.type !== "slot") return;

          const enabledSlot = subComponent?.enabledSlots?.find(
            (s: any) => s.slot === slotKey
          );

          if (enabledSlot) {
            // Externally provided slot — read directly from props to keep
            // `rest` out of the dep list (it's a new object every render).
            const slotName =
              enabledSlot.name || `${subComponent.fixedProps?.id}-${slotKey}`;
            clonedProps[slotKey] = props[slotName] ?? (() => null);
          } else {
            // Internal recursive slot
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
        }
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

    // ── Conditional render — AFTER all hooks ──────────────────────────────────
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

  // Custom comparator for SubComponentRenderer.
  //
  // Uses deep equality on subComponent (it may be a new reference even when
  // semantically unchanged if the parent SoftRender array is reconstructed)
  // and on props (the primary driver of field-mapping changes).
  // configComponents and softComponentFields are treated as stable config
  // references — reference equality is intentional and fast here.
  (prev, next) =>
    prev.depth === next.depth &&
    prev.index === next.index &&
    prev.configComponents === next.configComponents &&
    prev.softComponentFields === next.softComponentFields &&
    equal(prev.props, next.props) &&
    equal(prev.subComponent, next.subComponent) &&
    equal(prev.softComponentFieldSettings, next.softComponentFieldSettings)
);

SubComponentRenderer.displayName = "SubComponentRenderer";

// ─────────────────────────────────────────────────────────────────────────────
// SoftRender
//
// Maps a softSubComponent schema array to rendered output.
// Memoized with a custom comparator that correctly covers all props —
// the previous version omitted configComponents and softComponentFields,
// which would silently suppress re-renders when those changed.
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

  // Covers all five props — not just `props` and `softSubComponent`.
  // configComponents / softComponentFields: reference equality (stable config).
  // softComponentFieldSettings: deep equality (may carry dynamic defaults).
  // props / softSubComponent: deep equality (primary render drivers).
  (prev, next) =>
    prev.configComponents === next.configComponents &&
    prev.softComponentFields === next.softComponentFields &&
    equal(prev.props, next.props) &&
    equal(prev.softSubComponent, next.softSubComponent) &&
    equal(prev.softComponentFieldSettings, next.softComponentFieldSettings)
);

SoftRender.displayName = "SoftRender";