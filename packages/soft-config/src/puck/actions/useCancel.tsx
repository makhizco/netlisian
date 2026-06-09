"use client";
import { createUsePuck } from "@puckeditor/core";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useActionEvent } from "../hooks/useActionEvent";

const useCustomPuck = createUsePuck();

export const useCancel = () => {
  const cancel = useSoftConfig((s) => s.builder.cancel);
  const setHistories = useCustomPuck((s) => s.history.setHistories);
  const puckDispatch = useCustomPuck((s) => s.dispatch);
  const selectedItemSelector = useCustomPuck((s) => s.appState.ui.itemSelector);
  const status = useSoftConfig((s) => s.state);
  const { triggerAction } = useActionEvent();

  const handleCancel = () => {
    if (status === "ready") {
      notify.error("Nothing to cancel.");
      return;
    }

    try {
      cancel(setHistories, puckDispatch, selectedItemSelector);

      void triggerAction({
        type: "cancel",
        payload: {},
      });
    } catch (error) {
      alert("Failed to cancel:" + " " + error);
      notify.error(
        "Failed to cancel: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  };

  const canCancel = status === "building" || status === "remodeling";

  return { handleCancel, canCancel };
};
