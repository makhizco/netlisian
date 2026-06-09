"use client";
"use client"

import { ComponentData, createUsePuck, walkTree } from "@measured/puck";
import { useSoftConfig } from "../context/useStore";
import { notify } from "../lib/notify";
import { useActionEvent } from "../hooks/useActionEvent";
import { getPropertyByPath } from "../lib/get-prop-by-path";
import { setPropertyByPath } from "../lib/set-prop-by-path";

const useCustomPuck = createUsePuck();

export const useDecompose = () => {
  const decompose = useSoftConfig((s) => s.builder.decompose);
  const appState = useCustomPuck((s) => s.appState);
  const dispatch = useCustomPuck((s) => s.dispatch);
  const selectedItem = useCustomPuck((s) => s.selectedItem);
  const status = useSoftConfig((s) => s.state);
  const softComponents = useSoftConfig((s) => s.softComponents);
  const config = useSoftConfig((s) => s.softConfig);
  const contentAreaNames = useSoftConfig((s) => s.contentAreaNames);
  const { triggerAction } = useActionEvent();

  const handleDecompose = (componentData?: ComponentData) => {
    if (status !== "ready") {
      notify.error("Can only decompose when in ready state.");
      return;
    }

    const target = componentData || (selectedItem as ComponentData);
    if (!target) {
      notify.error("No component selected to decompose.");
      return;
    }

    const componentName = target.type;
    if (!Object.keys(softComponents).includes(componentName)) {
      notify.error("Selected component is not a soft component.");
      return;
    }

    try {
      const decomposedComponents = decompose(target);

      if (!decomposedComponents || decomposedComponents.length === 0) {
        notify.error("Nothing to decompose.");
        return;
      }

      // Walk Tree and replace the component with decomposed components
      let newData = { ...appState.data };
      const targetAreas = contentAreaNames && contentAreaNames.length > 0
        ? contentAreaNames
        : ["content"];

      targetAreas.forEach((path) => {
        const contentArray = getPropertyByPath(newData, path) || [];
        const walkedData = walkTree(
          { content: contentArray, root: newData.root || {} }, 
          config, 
          (components) => {
            const index = components.findIndex((c) => c.props.id === target.props.id);

            if (index !== -1) {
              components.splice(index, 1, ...decomposedComponents);
            }

            return components;
          }
        );
        setPropertyByPath(newData, path, walkedData.content);
      });

      dispatch({
        type: "setData",
        data: newData,
      });

      void triggerAction({
        type: "decompose",
        payload: {
          id: componentName,
        },
      });
    } catch (error) {
      alert("Failed to decompose:" + " " + error);
      notify.error(
        "Failed to decompose: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const canDecompose = (componentData?: ComponentData) => {
    const target = componentData || (selectedItem as ComponentData);
    return (
      status === "ready" &&
      target !== null &&
      Object.keys(softComponents).includes(target?.type || "")
    );
  };

  return { handleDecompose, canDecompose };
};
