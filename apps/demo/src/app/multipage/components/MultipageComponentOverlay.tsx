import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Props for the MultipageComponentOverlay component.
 */
export interface MultipageComponentOverlayProps {
  /** The child elements to render inside the overlay portal (typically none or action tools) */
  children?: React.ReactNode;
  /** The unique ID of the target Puck component */
  componentId: string;
  /** The type/name of the target component */
  componentType: string;
  /** Whether the component is currently being hovered in the editor */
  hover: boolean;
  /** Whether the component is currently selected in the editor */
  isSelected: boolean;
  /** Custom z-index styling for the overlay box */
  zIndex?: number;
}

/**
 * MultipageComponentOverlay is a custom Puck overlay replacement component.
 * It renders a visual bounding box directly on top of the hovered or selected component
 * by querying its DOM position and positioning itself absolutely relative to the flow workspace container.
 */
export const MultipageComponentOverlay = ({
  children,
  componentId,
  hover,
  isSelected,
  zIndex = 9998,
}: MultipageComponentOverlayProps) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Bind the portal target to the primary React Flow preview viewport
  useEffect(() => {
    const target =
      document.getElementById("preview-frame")?.children[0] || document.body;
    setPortalTarget(target as HTMLElement);
  }, []);

  // Run a high-frequency layout effect loop to keep the overlay aligned with the component rect
  useEffect(() => {
    if (!hover && !isSelected) {
      return;
    }

    let rafId: number;

    const measure = () => {
      const el = document.querySelector(`[data-puck-component="${componentId}"]`);

      if (el && portalTarget && overlayRef.current) {
        const rawRect = el.getBoundingClientRect();
        let x = rawRect.x;
        let y = rawRect.y;

        // Translate screen-space rect to absolute positions inside the portal container
        if (portalTarget !== document.body) {
          const targetRect = portalTarget.getBoundingClientRect();
          x = x - targetRect.x + portalTarget.scrollLeft;
          y = y - targetRect.y + portalTarget.scrollTop;
        }

        const width = rawRect.width;
        const height = rawRect.height;

        const style = overlayRef.current.style;
        style.top = `${y}px`;
        style.left = `${x}px`;
        style.width = `${width}px`;
        style.height = `${height}px`;
      }
      rafId = requestAnimationFrame(measure);
    };

    rafId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafId);
  }, [componentId, hover, isSelected, portalTarget]);

  if (!portalTarget || (!hover && !isSelected)) {
    return null;
  }

  const baseStyle: React.CSSProperties = {
    position: portalTarget === document.body ? "fixed" : "absolute",
    zIndex,
    pointerEvents: "none",
    boxSizing: "border-box",
    border: `2px solid ${isSelected ? "var(--puck-color-azure-07)" : hover ? "var(--puck-color-azure-09)" : "transparent"}`,
    backgroundColor: hover && !isSelected ? "color-mix(in srgb, var(--puck-color-azure-08) 30%, transparent)" : "transparent",
    transition: "border-color 0.15s ease, background-color 0.15s ease",
  };

  return createPortal(
    <div
      ref={overlayRef}
      style={baseStyle}
      data-puck-overlay="true"
      className={isSelected ? "isSelected" : hover ? "hover" : ""}
    >
      {children}
    </div>,
    portalTarget,
  );
};
