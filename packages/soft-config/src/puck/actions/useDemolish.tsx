import { createUsePuck } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { createSoftConfigStore } from "../store";
import { useActionEvent } from "../hooks/useActionEvent";

const useCustomPuck = createUsePuck();

export const useDemolish = () => {
  const demolish = useSoftConfig((s) => s.builder.demolish);
  const dispatch = useCustomPuck((s) => s.dispatch);
  const data = useCustomPuck((s) => s.appState.data);
  const status = useSoftConfig((s) => s.state);
  const softComponents = useSoftConfig((s) => s.softComponents);
  const { triggerAction } = useActionEvent();

  const handleDemolish = (componentName: string) => {
    if (status !== "ready") {
      notify.error("Can only demolish when in ready state.");
      return;
    }

    if (!Object.keys(softComponents).includes(componentName)) {
      notify.error("Component is not a soft component.");
      return;
    }

    try {
      demolish(componentName, data, dispatch);
      
      void triggerAction({
        type: "demolish",
        payload: {
          id: componentName,
        },
      });
    } catch (error) {
      console.error("Failed to demolish:", error);
      notify.error(
        "Failed to demolish: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const canDemolish = (componentName: string) => {
    return (
      status === "ready" && Object.keys(softComponents).includes(componentName)
    );
  };

  return { handleDemolish, canDemolish };
};
