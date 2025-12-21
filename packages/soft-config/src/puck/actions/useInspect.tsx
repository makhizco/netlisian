import { createUsePuck } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useEffect } from "react";
import { useActionEvent } from "../hooks/useActionEvent";

const useCustomPuck = createUsePuck();

export const useInspect = (componentName: string | null) => {
  const inspect = useSoftConfig((s) => s.builder.inspect);
  const dispatch = useCustomPuck((s) => s.dispatch);
  const status = useSoftConfig((s) => s.state);
  const { triggerAction } = useActionEvent();

  useEffect(() => {
    if (status !== "inspecting") return;
    if (!componentName) {
      notify.error("No component to inspect.");
      return;
    }

    try {
      inspect(componentName, dispatch);
      
      triggerAction({
        type: "inspect",
        payload: {
          id: componentName,
        },
      });
    } catch (error) {
      console.error("Failed to inspect:", error);
      notify.error(
        "Failed to inspect: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }, [status, componentName, inspect, dispatch, triggerAction]);
};
