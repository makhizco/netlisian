import React from "react";
import { PuckContext } from "@measured/puck";
import { ContainerElement } from "./container-elements";
import { LeafElement } from "./leaf-elements";
import { isLeafElement } from "./is-leaf-element";

const AdminImageElement = ({
  className,
  style,
  src,
  alt,
  puckRef,
  ...restProps
}: any) => {
  let backgroundSize = "cover";
  let backgroundPosition = "center";

  if (typeof className === "string") {
    // Handle positioning and sizing from Tailwind classes
    if (className.includes("object-contain")) backgroundSize = "contain";
    else if (className.includes("object-cover")) backgroundSize = "cover";
    else if (className.includes("object-fill")) backgroundSize = "100% 100%";
    else if (className.includes("object-none")) backgroundSize = "auto";
    else if (className.includes("object-scale-down")) backgroundSize = "contain";
    else if (className.includes("contain ")) backgroundSize = "contain"; // fallback for old usage

    if (className.includes("object-bottom")) backgroundPosition = "bottom";
    else if (className.includes("object-center")) backgroundPosition = "center";
    else if (className.includes("object-left-bottom")) backgroundPosition = "left bottom";
    else if (className.includes("object-left-top")) backgroundPosition = "left top";
    else if (className.includes("object-left")) backgroundPosition = "left";
    else if (className.includes("object-right-bottom")) backgroundPosition = "right bottom";
    else if (className.includes("object-right-top")) backgroundPosition = "right top";
    else if (className.includes("object-right")) backgroundPosition = "right";
    else if (className.includes("object-top")) backgroundPosition = "top";
  }

  return (
    <div
      ref={puckRef}
      {...restProps}
      className={className}
      role="img"
      aria-label={alt}
      style={{
        backgroundSize,
        backgroundRepeat: "no-repeat",
        backgroundImage: src ? `url('${src}')` : undefined,
        backgroundPosition,
        minHeight: "100px",
        width: "100%",
        ...(style as object),
      }}
    />
  );
};

const AdminPlaceholderElement = ({
  element,
  className,
  style,
  puckRef,
  src,
  ...restProps
}: any) => {
  return (
    <div
      ref={puckRef}
      {...restProps}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f3f4f6", // tailwind gray-100
        border: "1px dashed #9ca3af", // tailwind gray-400
        color: "#6b7280", // tailwind gray-500
        minHeight: "150px",
        width: "100%",
        fontFamily: "sans-serif",
        fontSize: "14px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        padding: "16px",
        ...(style as object),
      }}
    >
      {element.toUpperCase()} {src ? `- ${src}` : "(Placeholder)"}
    </div>
  );
};

export const renderAdmin = ({
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
      if (element === "img" && props.src) {
        return (
          <AdminImageElement
            puckRef={puck.dragRef}
            className={className}
            style={style}
            {...props}
          />
        );
      }

      if (
        ["iframe", "video", "audio", "embed", "object", "canvas"].includes(
          element as string
        )
      ) {
        return (
          <AdminPlaceholderElement
            element={element}
            puckRef={puck.dragRef}
            className={className}
            style={style}
            {...props}
          />
        );
      }

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
                    .map((s: any) => ({ [s.key]: s.value }))
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
