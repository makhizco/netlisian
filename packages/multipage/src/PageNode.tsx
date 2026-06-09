import React, { useState } from "react";
import { DropZone } from "@puckeditor/core";
import { Handle, Position, NodeProps, useStore } from "@xyflow/react";
import { PageItem } from "./MultipageRoot";

export const PageNode = ({ data, selected }: NodeProps) => {
  const page = data.page as PageItem;
  // Get the current zoom level from React Flow store to scale the label
  const zoom = useStore((s) => s.transform[2]);
  const [isHovered, setIsHovered] = useState(false);

  // Base font size is 24px.
  // We want the text to not appear smaller than 14px on the screen.
  // Since the node is scaled by `zoom`, its on-screen font size is `fontSize * zoom`.
  // To keep on-screen size >= 14, fontSize must be >= 14 / zoom.
  // In Figma, section labels stay relatively legible at small zoom levels.
  const minScreenSize = 14;
  const fontSize = Math.max(24, minScreenSize / zoom);

  // To keep the label just above the section with some padding
  const labelMarginBottom = Math.max(12, 8 / zoom);

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Section Label above the node */}
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
              : "var(--puck-color-grey-04)", // highlight if selected or hovered
          fontFamily: "sans-serif",
          display: "flex",
          alignItems: "center",
          gap: `${8 / zoom}px`, // scale gap as well
          transition: "color 0.2s",
          cursor: "grab", // Indicates draggable
          pointerEvents: "auto", // Ensure it can be clicked/dragged
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
            /{page.id}
          </span>
        )}
      </div>

      <div
        style={{
          width: 800,
          backgroundColor: "white",
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
        <div style={{ flexGrow: 1, minHeight: "800px" }}>
          <DropZone zone={page.id} />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
};
