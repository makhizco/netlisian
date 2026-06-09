import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

export interface MultipageComponentOverlayProps {
  children?: React.ReactNode;
  componentId: string;
  componentType: string;
  hover: boolean;
  isSelected: boolean;
  zIndex?: number;
}

export const MultipageComponentOverlay = ({
  children,
  componentId,
  hover,
  isSelected,
  zIndex = 9998,
}: MultipageComponentOverlayProps) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Target the child of the preview-frame
    const target =
      document.getElementById("preview-frame")?.children[0] || document.body;
    setPortalTarget(target as HTMLElement);
  }, []);

  useEffect(() => {
    if (!hover && !isSelected) {
      return;
    }

    let rafId: number;

    const measure = () => {
      let el = document.querySelector(`[data-puck-component="${componentId}"]`);

      if (el && portalTarget && overlayRef.current) {
        const rawRect = el.getBoundingClientRect();
        let x = rawRect.x;
        let y = rawRect.y;

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
    transition: "border-color 0.15s ease",
  };

  return createPortal(
    <div ref={overlayRef} style={baseStyle}>
      {children}
    </div>,
    portalTarget,
  );
};


