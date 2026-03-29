import { ComponentData } from "@measured/puck";
import { SoftSubComponent } from "../../types/SoftComponent";
import { generateId } from "../generate-id";
import { applyMapping } from "../apply-mapping";

export const subComponentDecomposer = (
  componentRootData: ComponentData,
  softSubComponent: SoftSubComponent[number]
): ComponentData => {
  const resolvedProps = {
    ...softSubComponent.fixedProps,
  };

  softSubComponent.map?.forEach((mapItem) => {
    const { newProps } = applyMapping(
      resolvedProps,
      {},
      [mapItem],
      "propsFirst",
      {
        sourceProps: componentRootData.props || {},
      }
    );

    Object.assign(resolvedProps, newProps);
  });

  // Convert enabled slots to key value object
  softSubComponent.enabledSlots.forEach(({ slot, name }) => {
    const referenceName = name || `${softSubComponent.fixedProps?.id}-${slot}`;
    resolvedProps[slot] = componentRootData.props?.[referenceName] || [];
  });

  // Convert subComponents to componentData
  Object.entries(softSubComponent.components).forEach(
    ([slotKey, subComponents]) => {
      resolvedProps[slotKey] = subComponents.map((subComponent) =>
        subComponentDecomposer(componentRootData, subComponent)
      );
    }
  );

  const accItem: ComponentData = {
    type: softSubComponent.type,
    props: {
      ...resolvedProps,
      id: generateId(softSubComponent.type),
    },
  };

  return accItem;
};
