import { createUsePuck } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useEffect } from "react";
import { useActionEvent } from "../hooks/useActionEvent";
import type { CompletedComponentResult } from "../store/slices/builder";

const useCustomPuck = createUsePuck();

// depricated - will be removed in favor of more generic useActionEvent for handling all action types including "inspect"



/** * Custom hook to handle inspecting a completed component in the Puck editor.
 * @deprecated This hook is deprecated
 * @param component - The completed component result to inspect. Should be set after completing a component.
 */
export const useInspect = (component: CompletedComponentResult | null) => {
  const inspect = useSoftConfig((s) => s.builder.inspect);
  const dispatch = useCustomPuck((s) => s.dispatch);
  const status = useSoftConfig((s) => s.state);
  const { triggerAction } = useActionEvent();

  useEffect(() => {
    if (status !== "inspecting") return;
    if (!component) {
      notify.error("No component to inspect.");
      return;
    }

    try {
      inspect(component.id, dispatch, null);

      void triggerAction({
        type: "inspect",
        payload: {
          id: component.id,
          version: component.version,
          softComponent: component.softComponent,
        },
      });
    } catch (error) {
      console.error("Failed to inspect:", error);
      notify.error(
        "Failed to inspect: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }, [status, component, inspect, dispatch, triggerAction]);
};
