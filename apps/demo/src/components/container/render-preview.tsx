import React from "react";
import { PuckContext } from "@puckeditor/core";
import { ContainerElement } from "./container-elements";
import { LeafElement } from "./leaf-elements";
import { isLeafElement } from "./is-leaf-element";

export const renderPreview = ({
  puck,
  element,
  props,
  className,
  style,
  noChild,
  slot,
  Item,
}: {
  puck: PuckContext;
  element: ContainerElement | LeafElement;
  props: any;
  className?: string | any;
  style?: any;
  noChild?: boolean;
  slot?: any;
  Item?: React.ComponentType<any>;
}) => {
  const Component = element as any;

  return React.useMemo(() => {
    if (isLeafElement(element as string) || noChild) {
      return React.createElement(Component, {
        ref: puck.dragRef,
        ...props,
        className,
        style,
      });
    } else {
      const SlotItem = Item ?? (() => null);

      const allowList = slot?.allow?.length
        ? typeof slot.allow[0] === "string"
          ? (slot.allow as string[]).map((el: string) => ({ element: el }))
          : (slot.allow as Array<{ element: string }>)
        : undefined;

      const disallowList = slot?.disallow?.length
        ? typeof slot.disallow[0] === "string"
          ? (slot.disallow as string[]).map((el: string) => ({ element: el }))
          : (slot.disallow as Array<{ element: string }>)
        : undefined;

      return (
        <SlotItem
          ref={puck.dragRef}
          {...props}
          as={Component}
          allow={allowList}
          disallow={disallowList}
          className={["h-auto!", className, slot?.className]
            .filter(Boolean)
            .join(" ")}
          style={{
            ...(style as object),
            ...(slot?.style?.length
              ? Object.assign(
                  {},
                  ...(slot?.style ?? [])
                    .filter((s: any) => s.key && typeof s.value === "string")
                    .map((s: any) => ({ [s.key]: s.value })),
                )
              : {}),
          }}
        />
      );
    }
  }, [
    Component,
    element,
    noChild,
    puck.dragRef,
    className,
    style,
    props,
    Item,
    slot,
  ]);
};
