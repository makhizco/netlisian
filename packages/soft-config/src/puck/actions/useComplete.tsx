import { createUsePuck } from "@puckeditor/core";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useState, useCallback } from "react";
import { useActionEvent } from "../hooks/useActionEvent";
import type { CompletedComponentResult } from "../store/slices/builder";

const useCustomPuck = createUsePuck();

export const useComplete = () => {
  const complete = useSoftConfig((s) => s.builder.complete);
  const appState = useCustomPuck((s) => s.appState);
  const setHistories = useCustomPuck((s) => s.history.setHistories);
  const getItemBySelector = useCustomPuck((s) => s.getItemBySelector);
  const status = useSoftConfig((s) => s.state);
  const [newComponent, setNewComponent] =
    useState<CompletedComponentResult | null>(null);
  const { triggerAction } = useActionEvent();

  const handleComplete = useCallback(() => {
    if (status === "ready") {
      notify.error("Not building or remodeling a component.");
      return null;
    }

    try {
      const completedComponent = complete(
        appState,
        setHistories,
        getItemBySelector,
      );
      setNewComponent(completedComponent);

      // Get the component data and soft component info
      const componentData = appState.data.root;

      if (componentData) {
        void triggerAction({
          type: "complete",
          payload: {
            id: completedComponent.id,
            version: completedComponent.version,
            componentData,
            softComponent: completedComponent.softComponent,
          },
        });
      }

      return completedComponent;
    } catch (error) {
      console.error("Failed to complete:", error);
      notify.error(
        "Failed to complete: " +
          (error instanceof Error ? error.message : String(error)),
      );
      return null;
    }
  }, [
    complete,
    appState,
    setHistories,
    status,
    triggerAction,
    getItemBySelector,
  ]);

  const canComplete = status === "building" || status === "remodeling";

  return { handleComplete, canComplete, newComponent, setNewComponent };
};
