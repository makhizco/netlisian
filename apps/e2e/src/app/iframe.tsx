import { initTailwind, TailwindProcessor } from "@netlisian/tailwind";
import React, { useEffect, useRef } from "react";
import { createUsePuck, Overrides, PuckApi } from "@puckeditor/core";
import { createUseSoftConfig } from "@netlisian/softconfig/puck";

const useCustomPuck = createUsePuck();

const useSoftConfig = createUseSoftConfig();

export const IframeOverride =
  (
    setTailwindProcessor: (processor: TailwindProcessor) => void,
  ): Overrides["iframe"] =>
  ({ document: iframeDocument, children }) => {
    const settingIframeDoc = useRef<boolean>(false);
    // Selectors — only for values needed during render
    const setIframeDocForSoftConfig = useSoftConfig((s) => s.setIframeDoc);
    const softConfigIframeDoc = useSoftConfig((s) => s.iframeDoc);
    const history = useCustomPuck((s) => s.history);
    const undo = history?.back;
    const setUndoFn = useSoftConfig((s) => s.setUndoFn);
    const undoFn = useSoftConfig((s) => s.undoFn);

    useEffect(() => {
      if (undoFn === undo) {
        return;
      }
      setUndoFn(undo);
    }, [undo, setUndoFn, undoFn]);

    useEffect(() => {
      // Fresh read inside effect — bypasses stale closure entirely
      if (!iframeDocument || softConfigIframeDoc) return;

      const init = () => {
        if (settingIframeDoc.current) return;

        settingIframeDoc.current = true;

        (requestAnimationFrame(() => {
          iframeDocument.body.style.color = "black";
          iframeDocument.body.style.backgroundColor = "white";
          initTailwind(iframeDocument).then((_p: TailwindProcessor) => {
            if (_p) setTailwindProcessor(_p);
          });
          setIframeDocForSoftConfig(iframeDocument);
        }),
          [iframeDocument]);
      };

      if (
        iframeDocument.readyState === "complete" ||
        iframeDocument.readyState === "interactive"
      ) {
        init();
      } else {
        iframeDocument.addEventListener("DOMContentLoaded", init, {
          once: true,
        });
        return () =>
          iframeDocument.removeEventListener("DOMContentLoaded", init);
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return <>{children}</>;
  };
