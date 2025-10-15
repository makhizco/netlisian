import { createUsePuck } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useEffect } from "react";

const useCustomPuck = createUsePuck();

export const useInspect = (componentName: string | null) => {
  const inspect = useSoftConfig((s) => s.builder.inspect);
  const dispatch = useCustomPuck((s) => s.dispatch);
  const status = useSoftConfig((s) => s.state);

  useEffect(() => {
    if (status !== "inspecting") return;
    if (!componentName) {
      notify.error("No component to inspect.");
      return;
    }

    try {
      inspect(componentName, dispatch);
    } catch (error) {
      console.error("Failed to inspect:", error);
      notify.error(
        "Failed to inspect: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }, [status, componentName, inspect, dispatch]);
};
