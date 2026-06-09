import React, { useEffect, useState } from "react";
import { createUsePuck, ActionBar } from "@measured/puck";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown } from "lucide-react";

const usePuck = createUsePuck();

const EMPTY_ARRAY: any[] = [];

export interface MultipageActionBarProps {
  children?: React.ReactNode;
  label?: string;
  parentAction?: React.ReactNode;
  offsetY?: number;
  offsetX?: number;
  zIndex?: number;
  /**
   * Optional custom wrapper that replaces `<ActionBar>` as the shell.
   * Receives the built-in action bar groups as `children`.
   * When not provided the default Puck `<ActionBar>` is used.
   */
  customActionBar?: React.ComponentType<{ children: React.ReactNode }>;
}

export const MultipageActionBar = ({
  children,
  label,
  parentAction,
  offsetY = -44,
  offsetX = 0,
  zIndex = 9999,
  customActionBar,
}: MultipageActionBarProps) => {
  const itemSelector = usePuck((s) => s.appState.ui.itemSelector);
  const isDragging = usePuck((s) => s.appState.ui.isDragging);
  const selectedItem = usePuck((s) => s.selectedItem);
  const dispatch = usePuck((s) => s.dispatch);

  const zoneData = usePuck((s) => {
    if (!itemSelector) return null;
    if (itemSelector.zone === "root")
      return s.appState.data.content || EMPTY_ARRAY;
    return s.appState.data.zones?.[itemSelector.zone as string] || EMPTY_ARRAY;
  });

  const barRef = React.useRef<HTMLDivElement>(null);
  const markerRef = React.useRef<HTMLSpanElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Reliably get the ID of the selected component using Puck's selection index and zones
  const id = React.useMemo(() => {
    if (!selectedItem) return null;

    return selectedItem?.props?.id;
  }, [itemSelector, selectedItem]);

  useEffect(() => {
    const target =
      document.getElementById("preview-frame")?.children[0] || document.body;
    setPortalTarget(target as HTMLElement);
  }, []);

  useEffect(() => {
    if (!id || isDragging) {
      if (barRef.current) {
        barRef.current.style.display = "none";
      }
      return;
    }

    let rafId: number;

    const measure = () => {
      // Check if this action bar instance belongs to a selected overlay
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

      let el = document.querySelector(`[data-puck-component="${id}"]`);

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
    display: "none", // Starts hidden until first frame measures
  };

  const Bar = customActionBar ?? ActionBar;

  return (
    <>
      <span ref={markerRef} style={{ display: "none" }} />
      {createPortal(
        <div
          ref={barRef}
          style={baseStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <Bar>
            <ActionBar.Group>
              {parentAction}
              {label && <ActionBar.Label label={label} />}
            </ActionBar.Group>
            <ActionBar.Group>{children}</ActionBar.Group>
          </Bar>
        </div>,
        portalTarget,
      )}
    </>
  );
};

