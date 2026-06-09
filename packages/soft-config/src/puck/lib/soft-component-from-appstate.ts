import { DefaultComponentProps, AppState, Field, Config, Fields, ComponentData } from "@measured/puck";
import { SoftComponent, SoftSubComponent } from "../types/SoftComponent";
import { BuilderRootConfig } from "../types/BuilderConfig";
import {
  buildArrayDefaultItemProps,
  buildArrayDefaultValue,
  getArrayItemSummary,
  getArrayBasePath,
  isArrayMappingPath,
} from "./array-field-utils";
import { TECHNICAL_KEYS } from "./soft-component-constants";
import { stripIdFromProps } from "./strip-id";
import {
  resolveCustomFieldDefinition,
  resolveCustomFieldReturnType,
  resolveCustomFieldSchema,
} from "./custom-fields";
import type { CustomFields } from "../types/SoftFields";
import { MapEntry } from "../types/Mapping";


const getSubComponents = (
  content: AppState["data"]["content"],
  componentConfigs: Config["components"],
  fieldSettings: DefaultComponentProps,
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

    const map = componentProps.props?._map || [];
    const mappedPaths = new Set<string>();
    map.forEach((item: MapEntry) => {
      const to = Array.isArray(item.to) ? item.to : [item.to];
      to.forEach((path: string | undefined) => {
        if (path) {
          if (isArrayMappingPath(path)) {
            const basePath = getArrayBasePath(path);
            if (basePath) mappedPaths.add(basePath);
          } else {
            mappedPaths.add(path);
          }
        }
      });
    });

    const fixedProps = Object.entries({
      ...componentConfig?.defaultProps,
      ...componentProps.props,
    } as DefaultComponentProps).reduce((acc, [key, value]) => {
      if (!TECHNICAL_KEYS.has(key) && !mappedPaths.has(key)) {
        acc[key] = value;
      }
      return acc;
    }, {} as DefaultComponentProps);

    (componentProps.props._slot || []).forEach(
      (s: { slot: string; name: string }) => {
        if (s.slot) {
          const slotComponentProps = componentProps.props[s.slot] ||
            componentConfig?.defaultProps?.[s.slot];

          (slots as Record<string, any>)[s.name || `${componentProps.props.id}-${s.slot}`] =
            stripIdFromProps(slotComponentProps,
              Object.keys(componentConfigs)
            );
        }
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
  fieldSettings: BuilderRootConfig["_fieldSettings"],
  customFields?: CustomFields
): { [key: string]: Field } => {
  return (
    fields?.reduce(
      (acc, field) => {
        const customFieldDefinition = resolveCustomFieldDefinition(
          field.type,
          customFields
        );
        const customReturnType = resolveCustomFieldReturnType(
          field.type,
          customFields
        );

        if (customFieldDefinition && customReturnType) {
          acc[field.name] = {
            ...customFieldDefinition.field,
            type: "custom",
            label: customFieldDefinition.field.label || field.name,
          } as Field;

          return acc;
        }

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
            const currentArraySettings = fieldSettings?.[field.name] || {};
            acc[field.name] = {
              type: field.type,
              label: field.name,
              min: currentArraySettings.min,
              max: currentArraySettings.max,
              arrayFields: softFieldsToPuckFields(
                currentArraySettings.subFields || [],
                currentArraySettings.subFieldSettings || {},
                customFields
              ),
              defaultItemProps: buildArrayDefaultItemProps(
                currentArraySettings.subFields,
                currentArraySettings.subFieldSettings
              ),
              getItemSummary(item, index) {
                return getArrayItemSummary(item, index, currentArraySettings);
              },
            };
            break;
          // TODO: Needs testing to see if it works
          case "object":
            acc[field.name] = {
              type: field.type,
              label: field.name,
              objectFields: softFieldsToPuckFields(
                fieldSettings?.[field.name]?.subFields || [],
                fieldSettings?.[field.name]?.subFieldSettings || {},
                customFields
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
  appState: AppState,
  configComponents: Config["components"],
  editedItem: ComponentData,
  metadata: {
    name: string;
    category?: string;
  },
  customFields?: CustomFields
): [SoftComponent, string] => {
  const rootProps = appState.data.root?.props || {};

  const fields = ((rootProps as Record<string, any>)._fields || []) as BuilderRootConfig["_fields"];
  const fieldSettings =
    ((rootProps as Record<string, any>)._fieldSettings as BuilderRootConfig["_fieldSettings"]) || {};
  const normalizedFieldSettings: BuilderRootConfig["_fieldSettings"] = {
    ...fieldSettings,
  };

  (fields || []).forEach((field) => {
    const customFieldDefinition = resolveCustomFieldDefinition(
      field.type,
      customFields
    );
    const customReturnType = resolveCustomFieldReturnType(
      field.type,
      customFields
    );

    if (!customFieldDefinition || !customReturnType) {
      return;
    }

    const schema = resolveCustomFieldSchema(field.type, customFields);
    const existingSettings = normalizedFieldSettings[field.name] || {};

    normalizedFieldSettings[field.name] = {
      ...existingSettings,
      customFieldType: field.type,
      customFieldReturnType: customReturnType,
      ...(schema
        ? {
          subFields: schema.subFields,
          subFieldSettings: schema.subFieldSettings,
        }
        : {}),
    };
  });

  // Extract all custom root fields (all starting with _ but not built-in)
  const builtInRootProps = new Set([
    "_name",
    "_category",
    "_version",
    "_versions",
    "_fields",
    "_fieldSettings",
  ]);

  const customRootProps = Object.keys(rootProps)
    .filter((key) => key.startsWith("_") && !builtInRootProps.has(key))
    .reduce(
      (acc, key) => {
        acc[key] = (rootProps as Record<string, any>)[key];
        return acc;
      },
      {} as DefaultComponentProps
    );

  const slots: SoftComponent["slots"] = {};

  const components = getSubComponents(
    [editedItem],
    configComponents,
    normalizedFieldSettings,
    slots
  );

  const defaultProps = {
    ...Object.keys(normalizedFieldSettings).reduce(
      (acc, field) => {
        const fieldDefinition = (fields || []).find((item) => item.name === field);
        const customFieldReturnType =
          normalizedFieldSettings[field]?.customFieldReturnType;

        if (
          fieldDefinition?.type === "array" ||
          customFieldReturnType === "array"
        ) {
          acc[field] =
            normalizedFieldSettings[field].defaultValue !== undefined
              ? normalizedFieldSettings[field].defaultValue
              : buildArrayDefaultValue(
                normalizedFieldSettings[field].subFields,
                normalizedFieldSettings[field].subFieldSettings
              );
          return acc;
        }

        acc[field] = normalizedFieldSettings[field].defaultValue;
        return acc;
      },
      {} as DefaultComponentProps
    ),
    ...slots,
  };

  return [
    {
      name: metadata.name,
      category: metadata.category,
      fields: {
        ...softFieldsToPuckFields(fields, normalizedFieldSettings, customFields),
        ...Object.keys(slots).reduce((acc, slot) => {
          acc[slot] = { type: "slot", label: slot };
          return acc;
        }, {} as Fields),
      },
      fieldSettings: normalizedFieldSettings,
      defaultProps,
      rootProps: customRootProps,
      components,
      slots,
    },
    (rootProps as Record<string, any>)._version || "1.0.0",
  ];
};
