import React, { useState } from "react";
import { Handle, Position, type NodeProps, useStore } from "@xyflow/react";
import { type PageItem } from "./MultipageRoot";

/**
 * PageNode renders a page viewport within the visual canvas grid layout.
 * It is rendered as a custom React Flow node, holding the Puck drop zones / slot editor container.
 */
export const PageNode = ({ data, selected }: NodeProps) => {
  const page = data.page as PageItem;

  // The slot function is seeded into node data once during initial node creation
  // in MultipageRoot. Puck's Slot component internally subscribes to the Puck store
  // and re-renders itself whenever the content changes, without requiring
  // React Flow updates or shared context.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SlotContent = (data as any).slot as React.ComponentType<{ style?: React.CSSProperties }> | undefined;

  // Access the canvas zoom level to scale labels dynamically
  const zoom = useStore((s) => s.transform[2]);
  const [isHovered, setIsHovered] = useState(false);

  const minScreenSize = 14;
  const fontSize = Math.max(24, minScreenSize / zoom);
  const labelMarginBottom = Math.max(12, 8 / zoom);

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Page Title & ID tag indicator */}
      <div
        className="custom-drag-handle"
        style={{
          position: "absolute",
          top: `-${fontSize + labelMarginBottom}px`,
          left: 0,
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          color:
            selected || isHovered
              ? "var(--puck-color-azure-07)"
              : "var(--puck-color-grey-04)",
          fontFamily: "sans-serif",
          display: "flex",
          alignItems: "center",
          gap: `${8 / zoom}px`,
          transition: "color 0.2s",
          cursor: "grab",
          pointerEvents: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <span>{page.title || page.id || "Untitled Page"}</span>
        {(isHovered || selected) && (
          <span
            style={{
              fontSize: `${fontSize * 0.7}px`,
              color: "var(--puck-color-grey-06)",
              fontFamily: "monospace",
              background: "var(--puck-color-grey-11)",
              padding: `${2 / zoom}px ${6 / zoom}px`,
              borderRadius: `${4 / zoom}px`,
            }}
          >
            {page.id}
          </span>
        )}
      </div>

      {/* Editor Frame Container */}
      <div
        style={{
          width: 800,
          backgroundColor: "var(--puck-color-white)",
          boxShadow:
            "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
          border: selected
            ? "2px solid var(--puck-color-azure-07)"
            : "1px solid var(--puck-color-grey-09)",
          borderRadius: "8px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transition: "border 0.2s, box-shadow 0.2s",
        }}
      >
        <div style={{ flexGrow: 1, minHeight: "1200px" }}>
          {SlotContent ? (
            <SlotContent
              style={{
                minHeight: 1200,
              }}
            />
          ) : (
            <div style={{ padding: 20, color: "var(--puck-color-red-04)" }}>
              Unable to render slot component content
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
};
