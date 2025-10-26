import React, { useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { SoftComponent, SoftSubComponent } from "../../types/SoftComponent";
import { Config, WithId, WithPuckProps } from "@measured/puck";
import { getFieldSettingsByPath } from "../../lib/get-settings-by-path";
import { setPropertyByPath } from "../../lib/set-prop-by-path";
import { ErrorBoundary } from "../error-boundary";

export function SoftRender({
  softComponentFields,
  softSubComponent,
  configComponents,
  props,
  depth = 0,
}: {
  softComponentFields: SoftComponent["fields"];
  softSubComponent: SoftSubComponent;
  configComponents: Config["components"];
  props: WithId<
    WithPuckProps<{
      [x: string]: any;
    }>
  >;
  depth?: number;
}) {
  const { id, puck, editMode, ...rest } = props;
  const mapCacheRef = useRef(new Map<string, any>());
  const prevPropsRef = useRef<string>("");

  // Clear cache when props change
  const propsSnapshot = JSON.stringify(props);
  if (prevPropsRef.current !== propsSnapshot) {
    mapCacheRef.current.clear();
    prevPropsRef.current = propsSnapshot;
  }

  // Extract root props that trigger updates
  const subComponentRootProps = useMemo(
    () =>
      Object.entries(softComponentFields || {})
        .filter(([_, field]) => field.type !== "slot")
        .reduce(
          (acc, [fieldKey]) => {
            acc[fieldKey] = props[fieldKey];
            return acc;
          },
          {} as Record<string, any>
        ),
    [softComponentFields, props]
  );

  const valuesToUpdateKey = useMemo(
    () => JSON.stringify(subComponentRootProps),
    [subComponentRootProps]
  );

  return (
    <>
      {softSubComponent?.length > 0 &&
        softSubComponent.map((subComponent, index) => {
          const componentConfig = configComponents[subComponent?.type];
          if (!componentConfig) return null;

          const resolvedProps = subComponent.fixedProps || {};

          // Generate ID: use parent id if depth 0, otherwise combine type + parent id + uuid + depth
          const stableId = useMemo(
            () =>
              depth === 0
                ? id
                : `${subComponent.type}-${id}-d${depth}-${uuidv4()}`,
            [id, depth, subComponent.type]
          );

          // Apply property mappings with cache
          if (subComponent.map?.length) {
            subComponent.map.forEach(({ from, to, transform }) => {
              const fromPaths = Array.isArray(from) ? from : from ? [from] : [];
              const toPaths = Array.isArray(to) ? to : to ? [to] : [];

              const inputValues = fromPaths.map((f) =>
                getFieldSettingsByPath(props || {}, f)
              );
              const cacheKey = JSON.stringify(inputValues);

              let result = mapCacheRef.current.get(cacheKey);
              if (!result) {
                result = transform
                  ? transform(inputValues, props)
                  : inputValues[0];
                mapCacheRef.current.set(cacheKey, result);
              }

              if (Array.isArray(result)) {
                result.forEach(
                  (val, i) =>
                    toPaths[i] &&
                    setPropertyByPath(resolvedProps, toPaths[i], val)
                );
              } else if (toPaths[0]) {
                setPropertyByPath(resolvedProps, toPaths[0], result);
              }
            });
          }

          // Apply slot configurations
          Object.entries(componentConfig.fields || {}).forEach(
            ([slotKey, field]) => {
              if (field.type === "slot") {
                const enabledSlot = subComponent?.enabledSlots?.find(
                  (s) => s.slot === slotKey
                );

                if (enabledSlot) {
                  const slotName =
                    enabledSlot.name ||
                    `${subComponent.fixedProps?.id}-${slotKey}`;
                  resolvedProps[slotKey] = useMemo(
                    () => rest[slotName] || (() => null),
                    [slotName]
                  );
                } else {
                  resolvedProps[slotKey] = useMemo(() => {
                    return ({
                      className,
                      style,
                    }: {
                      className?: string;
                      style?: React.CSSProperties;
                    }) => (
                      <div className={className} style={style}>
                        <SoftRender
                          key={slotKey}
                          softComponentFields={softComponentFields}
                          softSubComponent={
                            subComponent?.components?.[slotKey] ?? []
                          }
                          configComponents={configComponents}
                          props={props}
                          depth={depth + 1}
                        />
                      </div>
                    );
                  }, [valuesToUpdateKey]);
                }
              }
            }
          );

          const ComponentRender = componentConfig.render;

          return (
            <ErrorBoundary key={index}>
              <ComponentRender
                id={stableId}
                editMode={editMode}
                puck={puck}
                {...resolvedProps}
              />
            </ErrorBoundary>
          );
        })}
    </>
  );
}
