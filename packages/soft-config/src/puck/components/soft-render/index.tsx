import React, { useMemo } from "react";
import { SoftComponent, SoftSubComponent } from "../../types/SoftComponent";
import { Config, WithId, WithPuckProps } from "@measured/puck";
import { getFieldSettingsByPath } from "../../lib/get-settings-by-path";
import { setPropertyByPath } from "../../lib/set-prop-by-path";
import { generateId } from "../../lib/generate-id";
import { ErrorBoundary } from "../error-boundary";

export function SoftRender({
  softComponentFields,
  softSubComponent,
  configComponents,
  props,
}: {
  softComponentFields: SoftComponent["fields"];
  softSubComponent: SoftSubComponent;
  configComponents: Config["components"];
  props: WithId<
    WithPuckProps<{
      [x: string]: any;
    }>
  >;
}) {
  const { id, puck, editMode, ...rest } = props;

  return (
    <>
      {softSubComponent?.length > 0 &&
        softSubComponent.map((subComponent, index) => {
          const componentConfig = configComponents[subComponent?.type];
          if (!componentConfig) {
            return null;
          }

          const resolvedProps = subComponent.fixedProps || {};

          const stableId = useMemo(
            () => generateId(subComponent.type),
            [subComponent.type]
          );

          // Check root props changed
          const subComponentRootProps = Object.entries(
            softComponentFields || {}
          )
            .filter(([key, field]) => field.type !== "slot")
            .reduce(
              (acc, [fieldKey, _]) => {
                acc[fieldKey] = props[fieldKey];
                return acc;
              },
              {} as { [key: string]: any }
            );

          const valuesToUpdateKey = useMemo(
            () => JSON.stringify(subComponentRootProps),
            [subComponentRootProps]
          );

          Object.entries(componentConfig.fields || {}).forEach(
            ([key, field]) => {
              if (field.type === "slot") {
                if (
                  subComponent?.enabledSlots &&
                  subComponent.enabledSlots?.some((s) => s.slot == key)
                ) {
                  const slotName =
                    subComponent.enabledSlots.find((s) => s.slot === key)
                      ?.name || `${subComponent.fixedProps?.id}-${key}`;

                  resolvedProps[key] = useMemo(
                    () => rest[slotName] || (() => null),
                    [slotName]
                  );
                } else {
                  resolvedProps[key] = useMemo(() => {
                    return ({
                      className,
                      style,
                    }: {
                      className?: string;
                      style?: React.CSSProperties;
                    }) => (
                      <div className={className} style={style}>
                        <SoftRender
                          key={key}
                          softComponentFields={softComponentFields}
                          softSubComponent={
                            subComponent?.components[key]
                              ? subComponent.components[key]
                              : []
                          }
                          configComponents={configComponents}
                          props={{ ...props }}
                        />
                      </div>
                    );
                  }, [valuesToUpdateKey]);
                }
              }
            }
          );

          subComponent.map.forEach(
            (mapItem: { from?: string; to?: string }) => {
              const value = getFieldSettingsByPath(props, mapItem.from || "");

              setPropertyByPath(resolvedProps, mapItem.to || "", value);
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
