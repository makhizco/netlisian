import { ComponentData } from "@measured/puck";
import { SoftSubComponent } from "../../types/SoftComponent";
import { generateId } from "../generate-id";
import { getFieldSettingsByPath } from "../get-settings-by-path";
import { setPropertyByPath } from "../set-prop-by-path";

export const subComponentDecomposer = (
  componentRootData: ComponentData,
  softSubComponent: SoftSubComponent[number]
): ComponentData => {
  const resolvedProps = {
    ...softSubComponent.fixedProps,
  };

  softSubComponent.map?.forEach((mapItem) => {
    const { from, to, transform } = mapItem || {};
    const fromPaths = Array.isArray(from) ? from : from ? [from] : [];
    const toPaths = Array.isArray(to) ? to : to ? [to] : [];

    const inputs = fromPaths.map((path) =>
      getFieldSettingsByPath(componentRootData.props || {}, path)
    );

    const runner = transform;
    const result = runner ? runner(inputs, componentRootData.props) : inputs[0];

    if (Array.isArray(result)) {
      result.forEach((val, idx) => {
        if (toPaths[idx]) setPropertyByPath(resolvedProps, toPaths[idx], val);
      });
    } else if (toPaths[0]) {
      setPropertyByPath(resolvedProps, toPaths[0], result);
    }
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
