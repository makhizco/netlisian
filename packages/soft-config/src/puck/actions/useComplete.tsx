import { createUsePuck } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useState, useCallback } from "react";
import { useActionEvent } from "../hooks/useActionEvent";

const useCustomPuck = createUsePuck();

export const useComplete = () => {
  const complete = useSoftConfig((s) => s.builder.complete);
  const appState = useCustomPuck((s) => s.appState);
  const setHistories = useCustomPuck((s) => s.history.setHistories);
  const status = useSoftConfig((s) => s.state);
  const softComponents = useSoftConfig((s) => s.softComponents);
  const [newComponent, setNewComponent] = useState<string | null>(null);
  const { triggerAction } = useActionEvent();

  const handleComplete = useCallback(() => {
    if (status === "ready") {
      notify.error("Not building or remodeling a component.");
      return null;
    }

    try {
      const componentName = complete(appState, setHistories);
      setNewComponent(componentName);
      
      // Get the component data and soft component info
      const componentData = appState.data.root;
      const softComponent = softComponents[componentName]?.versions[softComponents[componentName]?.defaultVersion];
      
      if (softComponent && componentData) {
        triggerAction({
          type: "complete",
          payload: {
            id: componentName,
            componentData,
            softComponent,
          },
        });
      }
      
      return componentName;
    } catch (error) {
      console.error("Failed to complete:", error);
      notify.error(
        "Failed to complete: " +
          (error instanceof Error ? error.message : String(error))
      );
      return null;
    }
  }, [complete, appState, setHistories, status, softComponents, triggerAction]);

  const canComplete = status === "building" || status === "remodeling";

  return { handleComplete, canComplete, newComponent, setNewComponent };
};
