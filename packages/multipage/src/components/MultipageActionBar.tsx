import React, { useEffect, useState } from "react";
import { createUsePuck, ActionBar } from "@puckeditor/core";
import { createPortal } from "react-dom";

const usePuck = createUsePuck();

/**
 * Props configuration for the MultipageActionBar component.
 */
export interface MultipageActionBarProps {
  /** The action buttons or items rendered inside the custom action bar group */
  children?: React.ReactNode;
  /** Optional label text to render inside the action bar */
  label?: string;
  /** Optional custom action node to prefix before the label */
  parentAction?: React.ReactNode;
  /** Vertical offset adjustment from the target element (defaults to -44px) */
  offsetY?: number;
  /** Horizontal offset adjustment from the target element (defaults to 0) */
  offsetX?: number;
  /** The overlay stack z-index (defaults to 9999) */
  zIndex?: number;
}

/**
 * MultipageActionBar is a custom override for the Puck ActionBar.
 * It detects the active component selection within the multipage flow and overlays
 * helper action tools directly over the selected element.
 */
export const MultipageActionBar = ({
  children,
  label,
  parentAction,
  offsetY = -44,
  offsetX = 0,
  zIndex = 9999,
}: MultipageActionBarProps) => {
  const itemSelector = usePuck((s) => s.appState.ui.itemSelector);
  const isDragging = usePuck((s) => s.appState.ui.isDragging);
  const selectedItem = usePuck((s) => s.selectedItem);

  const barRef = React.useRef<HTMLDivElement>(null);
  const markerRef = React.useRef<HTMLSpanElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Retrieve target component ID from the active selection context
  const id = React.useMemo(() => {
    if (!selectedItem) return null;
    return selectedItem?.props?.id;
  }, [selectedItem]);

  // Dynamically attach the action bar to the layout canvas viewport container
  useEffect(() => {
    const target =
      document.getElementById("preview-frame")?.children[0] || document.body;
    setPortalTarget(target as HTMLElement);
  }, []);

  // Update layout positioning dynamically relative to the target component's bounding box
  useEffect(() => {
    if (!id || isDragging) {
      if (barRef.current) {
        barRef.current.style.display = "none";
      }
      return;
    }

    let rafId: number;

    const measure = () => {
      // Hide the action bar if the surrounding overlay is no longer active/selected
      if (markerRef.current) {
        const overlayEl = markerRef.current.closest("[data-puck-overlay]");
        if (overlayEl && !overlayEl.className.includes("isSelected")) {
          if (barRef.current) {
            barRef.current.style.display = "none";
          }
          rafId = requestAnimationFrame(measure);
          return;
        }
      }

      const el = document.querySelector(`[data-puck-component="${id}"]`);

      if (el && portalTarget && barRef.current) {
        barRef.current.style.display = "block";
        const rawRect = el.getBoundingClientRect();
        let x = rawRect.x;
        let y = rawRect.y;

        if (portalTarget !== document.body) {
          const targetRect = portalTarget.getBoundingClientRect();
          x = x - targetRect.x + portalTarget.scrollLeft;
          y = y - targetRect.y + portalTarget.scrollTop;
        }

        const barWidth = barRef.current.offsetWidth || 0;
        const top = Math.max(12, y + offsetY);
        const left = Math.max(12, x + rawRect.width - barWidth + offsetX);

        const style = barRef.current.style;
        style.top = `${top}px`;
        style.left = `${left}px`;
      } else if (barRef.current) {
        barRef.current.style.display = "none";
      }
      rafId = requestAnimationFrame(measure);
    };

    rafId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafId);
  }, [id, isDragging, portalTarget, offsetX, offsetY]);

  if (!portalTarget || !id) {
    return <span ref={markerRef} style={{ display: "none" }} />;
  }

  const baseStyle: React.CSSProperties = {
    position: portalTarget === document.body ? "fixed" : "absolute",
    zIndex,
    pointerEvents: "auto",
    whiteSpace: "nowrap",
    display: "none",
  };

  return (
    <>
      <span ref={markerRef} style={{ display: "none" }} />
      {createPortal(
        <div
          ref={barRef}
          style={baseStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionBar>
            <ActionBar.Group>
              {parentAction}
              {label && <ActionBar.Label label={label} />}
            </ActionBar.Group>

            <ActionBar.Group>{children}</ActionBar.Group>
          </ActionBar>
        </div>,
        portalTarget,
      )}
    </>
  );
};
