"use client";
import type { PuckAction, PuckApi } from "@puckeditor/core";
import { notify } from "./notify";

/**
 * Create an action callback that validates and handles actions with undo support
 *
 * @param validateAction Function to validate if an action is allowed
 * @param undo Function to undo the last action (from Puck's history)
 * @returns Action handler function
 */
export const createActionCallback = (
  validateAction: (action: PuckAction) => boolean,
  undo: PuckApi["history"]["back"] | null,
) => {
  return (action: PuckAction) => {
    if (!undo) {
      return;
    }
    const isValid = validateAction(action);

    if (!isValid) {
      notify.error(
        "Editing outside the soft component is not allowed when you are editing component definition.",
      );
      requestAnimationFrame(() => undo());
    }
  };
};
