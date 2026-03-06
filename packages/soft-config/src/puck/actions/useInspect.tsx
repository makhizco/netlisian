import { createUsePuck } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useEffect } from "react";
import { useActionEvent } from "../hooks/useActionEvent";
import type { CompletedComponentResult } from "../store/slices/builder";

const useCustomPuck = createUsePuck();

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
      inspect(component.id, dispatch);

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
