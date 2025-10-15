import { AppState, Field, Config, Fields } from "@measured/puck";
import { SoftComponent, SoftSubComponent } from "../types/SoftComponent";
import { BuilderRootConfig } from "../types/BuilderConfig";

const getSubComponents = (
  content: AppState["data"]["content"],
  componentConfigs: Config["components"],
  fieldSettings: Record<string, any>,
  slots: SoftComponent["slots"]
): SoftComponent["components"] => {
  if (!content || !Array.isArray(content)) return [];

  return content.map((componentProps) => {
    const componentConfig = componentConfigs[componentProps.type];

    const enabledSlotNames = new Set(
      (componentProps.props?._slot || []).map((s: { slot: string }) => s.slot)
    );
    const components =
      Object.entries(componentConfig?.fields || {})
        .filter(
          ([key, field]) => field.type === "slot" && !enabledSlotNames.has(key) // Skip if slot is enabled
        )
        .reduce(
          (acc, [fieldKey, _]) => {
            acc[fieldKey] = getSubComponents(
              (componentProps.props?.[
                fieldKey
              ] as AppState["data"]["content"]) || [],
              componentConfigs,
              fieldSettings,
              slots
            );
            return acc;
          },
          {} as { [slot: string]: SoftSubComponent }
        ) || {};

    const fixedProps = {
      ...componentConfig?.defaultProps,
      ...componentProps.props,
    };

    (componentProps.props._slot || []).forEach(
      (s: { slot: string; name: string }) => {
        if (s.slot)
          slots[s.name || `${componentProps.props.id}-${s.slot}`] =
            componentProps.props[s.slot] ||
            componentConfig?.defaultProps?.[s.slot];
      }
    );

    const subComponent: SoftSubComponent[number] = {
      map: componentProps.props?._map || [],
      fixedProps: fixedProps,
      type: componentProps.type,
      components: components,
      enabledSlots: componentProps.props?._slot || [],
    };

    return subComponent;
  });
};

const softFieldsToPuckFields = (
  fields: BuilderRootConfig["_fields"],
  fieldSettings: BuilderRootConfig["_fieldSettings"]
): { [key: string]: Field } => {
  return (
    fields?.reduce(
      (acc, field) => {
        switch (field.type) {
          case "text":
          case "textarea":
            acc[field.name] = { type: field.type, label: field.name };
            break;
          case "number":
            acc[field.name] = {
              type: field.type,
              label: field.name,
              min: fieldSettings?.[field.name]?.min,
              max: fieldSettings?.[field.name]?.max,
              step: fieldSettings?.[field.name]?.step,
            };
            break;
          case "select":
          case "radio":
            acc[field.name] = {
              type: field.type,
              label: field.name,
              options: fieldSettings?.[field.name]?.options || [],
            };
            break;
          // TODO: Default item props
          case "array":
            acc[field.name] = {
              type: field.type,
              label: field.name,
              arrayFields: softFieldsToPuckFields(
                fieldSettings?.[field.name]?.subFields || [],
                fieldSettings?.[field.name]?.subFieldSettings || {}
              ),
            };
            break;
          // TODO: Needs testing to see if it works
          case "object":
            acc[field.name] = {
              type: field.type,
              label: field.name,
              objectFields: softFieldsToPuckFields(
                fieldSettings?.[field.name]?.subFields || [],
                fieldSettings?.[field.name]?.subFieldSettings || {}
              ),
            };
            break;
          default:
            acc[field.name] = { type: "text", label: field.name };
        }

        return acc;
      },
      {} as { [key: string]: Field }
    ) || {}
  );
};

export const softComponentFromAppState = (
  appState: AppState<any>,
  configComponents: Config["components"]
): [SoftComponent, string] => {
  const rootProps = appState.data.root?.props || {};

  const fields = (rootProps._fields || []) as BuilderRootConfig["_fields"];
  const field_settings =
    (rootProps._fieldSettings as BuilderRootConfig["_fieldSettings"]) || {};

  const slots: SoftComponent["slots"] = {};

  const components = getSubComponents(
    appState.data.content || [],
    configComponents,
    field_settings,
    slots
  );

  const defaultProps = {
    ...Object.keys(field_settings).reduce(
      (acc, field) => {
        acc[field] = field_settings[field].defaultValue;
        return acc;
      },
      {} as Record<string, any>
    ),
    ...slots,
  };

  return [
    {
      fields: {
        ...softFieldsToPuckFields(fields, field_settings),
        ...Object.keys(slots).reduce((acc, slot) => {
          acc[slot] = { type: "slot", label: slot };
          return acc;
        }, {} as Fields),
      },
      defaultProps,
      components,
      slots,
    },
    rootProps._version || "1.0.0",
  ];
};
