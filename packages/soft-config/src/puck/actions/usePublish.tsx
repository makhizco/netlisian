import { createUsePuck, Data } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { SoftComponents } from "../types/SoftComponent";

const useCustomPuck = createUsePuck();

export const usePublish = () => {
  const components = useSoftConfig((s) => s.softComponents);
  const data = useCustomPuck((s) => s.appState.data);
  const status = useSoftConfig((s) => s.state);

  const handlePublish = (
    publish: (data: Data, softComponents: SoftComponents) => void,
  ) => {
    if (status !== "ready") {
      notify.error("Can only publish when in ready state.");
      return;
    }
    if (!data) {
      notify.error("No data to publish.");
      return;
    }

    publish(data, components)
  };

  const canPublish = status === "ready";

  return { handlePublish, canPublish };
};
