import { createUsePuck } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useActionEvent } from "../hooks/useActionEvent";

const useCustomPuck = createUsePuck();

export const useRemodel = () => {
  const remodel = useSoftConfig((s) => s.builder.remodel);
  const history = useCustomPuck((s) => s.history.histories);
  const selectedItem = useCustomPuck((s) => s.selectedItem);
  const itemSelector = useCustomPuck((s) => s.appState.ui.itemSelector);
  const dispatch = useCustomPuck((s) => s.dispatch);
  const status = useSoftConfig((s) => s.state);
  const softComponents = useSoftConfig((s) => s.softComponents);
  const { triggerAction } = useActionEvent();

  const handleRemodel = (componentName?: string) => {
    if (status !== "ready") {
      notify.error("Can only remodel when in ready state.");
      return;
    }

    const name = componentName || selectedItem?.type;
    if (!name || !Object.keys(softComponents).includes(name)) {
      notify.error("Selected component is not a soft component.");
      return;
    }

    try {
      remodel(history, selectedItem, itemSelector, dispatch);

      void triggerAction({
        type: "remodel",
        payload: {
          id: name,
        },
      });
    } catch (error) {
      console.error("Failed to remodel:", error);
      notify.error(
        "Failed to remodel: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const canRemodel = (componentName?: string) => {
    const name = componentName || selectedItem?.type;
    return (
      status === "ready" &&
      name !== undefined &&
      Object.keys(softComponents).includes(name)
    );
  };

  return { handleRemodel, canRemodel };
};
