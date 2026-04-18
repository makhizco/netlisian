import { ComponentData, ComponentDataOptionalId } from "@measured/puck";

export const stripIdFromProps = (
  components: ComponentData[],
  allowedTypes: string[]
): ComponentDataOptionalId[] => {
  return components.map((component) => sanitizeComponent(component, allowedTypes));
};

const sanitizeComponent = (
  component: ComponentData,
  allowedTypes: string[]
): ComponentDataOptionalId => {
  const cleanProps: ComponentDataOptionalId['props'] = {};

  for (const [key, value] of Object.entries(component.props)) {
    if (key === "id") continue;

    // Nested component
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      allowedTypes.includes((value as any).type)
    ) {
      cleanProps[key] = sanitizeComponent(value as ComponentData, allowedTypes);
      continue;
    }

    cleanProps[key] = value;
  }

  return {
    ...component,
    props: cleanProps,
  };
};
