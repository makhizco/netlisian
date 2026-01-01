import { createUsePuck } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useActionEvent } from "../hooks/useActionEvent";

const useCustomPuck = createUsePuck();

export const useBuild = () => {
  const build = useSoftConfig((s) => s.builder.build);
  const history = useCustomPuck((s) => s.history.histories);
  const selectedItem = useCustomPuck((s) => s.selectedItem);
  const itemSelector = useCustomPuck((s) => s.appState.ui.itemSelector);
  const dispatch = useCustomPuck((s) => s.dispatch);
  const status = useSoftConfig((s) => s.state);
  const { triggerAction } = useActionEvent();

  const handleBuild = () => {
    if (status !== "ready") {
      notify.error("Can only build when in ready state.");
      return;
    }

    try {
      build(history, selectedItem, itemSelector, dispatch);
      
      if (selectedItem?.type) {
        void triggerAction({
          type: "build",
          payload: {
            id: selectedItem.type,
          },
        });
      }
    } catch (error) {
      console.error("Failed to build:", error);
      notify.error(
        "Failed to build: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  return { handleBuild, canBuild: status === "ready" };
};
