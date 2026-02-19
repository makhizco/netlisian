import { useCallback } from "react";
import { useSoftConfig } from "../context/useStore";
import type { ActionEventPayload } from "../types/ActionEvents";

export const useActionEvent = () => {
  const onActions = useSoftConfig((s) => s.onActions);

  const triggerAction = useCallback(
    async (event: ActionEventPayload) => {
      if (onActions) {
        try {
          await onActions(event);
        } catch (error) {
          console.error("Error in onActions callback:", error);
        }
      }
    },
    [onActions]
  );

  return { triggerAction };
};
