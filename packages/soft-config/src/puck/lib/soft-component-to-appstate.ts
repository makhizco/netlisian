import { AppState, ComponentData, ComponentDataOptionalId, Config, Fields } from "@measured/puck";
import { SoftSubComponent } from "../types/SoftComponent";
import { VersionedSoftComponent } from "../types/SoftComponent";
import { generateId } from "./generate-id";
import { BuilderRootConfig } from "../types/BuilderConfig";
import { getFieldSettingsByPath } from "./get-settings-by-path";
import { setPropertyByPath } from "./set-prop-by-path";
import { getComponentNameFromKey } from "./component-key";
import { Overrides } from "../types/Overrides";
import {
  buildArrayDefaultValue,
  getArrayBasePath,
  isArrayMappingPath,
} from "./array-field-utils";
import { applyMapping } from "./apply-mapping";

const mergeFieldSettings = (
  generated: BuilderRootConfig["_fieldSettings"] = {},
  persisted: BuilderRootConfig["_fieldSettings"] = {}
): BuilderRootConfig["_fieldSettings"] => {
  return Object.entries(persisted).reduce((acc, [fieldName, value]) => {
    const current = acc[fieldName] || {};

    acc[fieldName] = {
      ...current,
      ...value,
      subFieldSettings:
        current.subFieldSettings || value?.subFieldSettings
          ? mergeFieldSettings(
              current.subFieldSettings || {},
              value?.subFieldSettings || {}
            )
          : undefined,
    };

    return acc;
  }, { ...generated });
};

/**
 * Convert Puck fields back to soft field definitions
 */
const puckFieldsToSoftFields = (
  fields: Fields,
  slots: Set<string>
): {
  fields: BuilderRootConfig["_fields"];
  fieldSettings: BuilderRootConfig["_fieldSettings"];
} => {
  const softFields: BuilderRootConfig["_fields"] = [];
  const fieldSettings: BuilderRootConfig["_fieldSettings"] = {};

  Object.entries(fields).forEach(([fieldName, field]) => {
    // Skip slot fields as they're handled separately
    if (slots.has(fieldName)) {
      return;
    }

    // Skip the _version field as it's implicit
    if (fieldName === "_version") {
      return;
    }

    switch (field.type) {
      case "text":
      case "textarea":
        softFields.push({ name: fieldName, type: field.type });
        break;

      case "number":
        softFields.push({ name: fieldName, type: "number" });
        fieldSettings[fieldName] = {
          min: field.min,
          max: field.max,
          step: field.step,
        };
        break;

      case "select":
      case "radio":
        softFields.push({ name: fieldName, type: field.type });
        fieldSettings[fieldName] = {
          options: field.options || [],
        };
        break;

      case "array":
        softFields.push({ name: fieldName, type: "array" });
        const arrayFieldsResult = puckFieldsToSoftFields(
          field.arrayFields || {},
          new Set()
        );
        fieldSettings[fieldName] = {
          subFields: arrayFieldsResult.fields,
          subFieldSettings: arrayFieldsResult.fieldSettings,
        };
        break;

      case "object":
        softFields.push({ name: fieldName, type: "object" });
        const objectFieldsResult = puckFieldsToSoftFields(
          field.objectFields || {},
          new Set()
        );
        fieldSettings[fieldName] = {
          subFields: objectFieldsResult.fields,
          subFieldSettings: objectFieldsResult.fieldSettings,
        };
        break;

      default:
        softFields.push({ name: fieldName, type: "text" });
    }

    // Add default value from defaultProps if it exists
    if (fieldSettings[fieldName]) {
      fieldSettings[fieldName].defaultValue = undefined;
    } else {
      fieldSettings[fieldName] = { defaultValue: undefined };
    }
  });

  return { fields: softFields, fieldSettings };
};

/**
 * Reconstruct component data from soft sub-components
 */
const reconstructComponents = (
  subComponents: SoftSubComponent,
  componentConfigs: Config["components"],
  softComponentProps: Record<string, any>
): ComponentData[] => {
  return subComponents.map((subComponent) => {
    const componentConfig = componentConfigs[subComponent.type];

    // Start with fixed props and technical metadata
    const props: Record<string, any> = {
      ...subComponent.fixedProps,
      _map: subComponent.map,
    };

    const arrayDefaults = (subComponent.map || []).reduce(
      (acc, mapEntry) => {
        const toPaths = Array.isArray(mapEntry.to) ? mapEntry.to : [mapEntry.to];
        toPaths.forEach((path) => {
          if (typeof path !== "string" || !isArrayMappingPath(path)) return;
          const arrayBase = getArrayBasePath(path);
          if (!arrayBase || acc[arrayBase]) return;

          const defaultValue = componentConfig?.defaultProps?.[arrayBase];
          if (Array.isArray(defaultValue)) acc[arrayBase] = defaultValue;
        });
        return acc;
      },
      {} as Record<string, any[]>
    );

    const sourceProps = {
      ...(componentConfig?.defaultProps || {}),
      ...softComponentProps,
      ...props,
    };

    // Use applyMapping to resolve and merge mapped values
    // This handles array mappings, transforms, and unmappedArrayItemDefaultValues
    const { newProps } = applyMapping(
      props,
      {}, // fieldSettings not needed for "propsFirst" mode as it resolves from propsFirst
      subComponent.map || [],
      "propsFirst",
      {
        sourceProps,
        arrayDefaults,
      }
    );

    // Update props with mapped values
    Object.assign(props, newProps);

    // Handle enabled slots
    if (subComponent.enabledSlots.length > 0) {
      props._slot = subComponent.enabledSlots;

      // Add slot content from soft component props
      subComponent.enabledSlots.forEach(({ slot, name }) => {
        const slotName = name || `${props.id}-${slot}`;
        if (softComponentProps[slotName] !== undefined) {
          props[slot] = softComponentProps[slotName];
        }
      });
    }

    // Recursively handle nested components in other slots
    Object.entries(subComponent.components).forEach(([slotKey, nestedComponents]) => {
      if (nestedComponents.length > 0) {
        props[slotKey] = reconstructComponents(
          nestedComponents,
          componentConfigs,
          softComponentProps
        );
      } else {
        props[slotKey] = [];
      }
    });

    const componentData: ComponentData = {
      type: subComponent.type,
      props: {
        id: props.id || generateId(subComponent.type),
        ...props,
      },
    };

    return componentData;
  });
};

/**
 * Convert a soft component back to AppState format for remodeling.
 * This is the inverse operation of softComponentFromAppState.
 *
 * @param softComponent - The soft component to convert
 * @param componentName - The name of the soft component
 * @param version - The version of the soft component
 * @param versions - The available versions of the soft component
 * @param componentProps - The props from the soft component instance
 * @param componentConfigs - The available component configs
 * @returns AppState data object with root props and content
 */
export const softComponentToAppState = (
  softComponent: VersionedSoftComponent["versions"][string],
  componentName: string,
  version: string,
  versions: string[],
  componentProps: Record<string, any>,
  componentConfigs: Config["components"],
  overrides: Overrides,
  displayName?: string,
  category?: string
): Pick<AppState["data"], "root" | "content"> => {
  // Convert soft fields back to builder format
  const slots = new Set(Object.keys(softComponent.slots));
  const { fields, fieldSettings } = puckFieldsToSoftFields(
    softComponent.fields,
    slots
  );
  const mergedFieldSettings = mergeFieldSettings(
    fieldSettings,
    softComponent.fieldSettings || {}
  ) || {};

  // Set default values from soft component
  Object.entries(softComponent.defaultProps).forEach(([key, value]) => {
    if (mergedFieldSettings && mergedFieldSettings[key] && !slots.has(key)) {
      mergedFieldSettings[key].defaultValue = value;
    }
  });

  (fields || []).forEach((field) => {
    if (field.type !== "array" || slots.has(field.name)) return;

    const settings = mergedFieldSettings[field.name] || {};
    if (settings.defaultValue === undefined) {
      settings.defaultValue = buildArrayDefaultValue(
        settings.subFields,
        settings.subFieldSettings
      );
    }

    mergedFieldSettings[field.name] = settings;
  });

  // Build root props for the builder
  let rootProps: BuilderRootConfig = {
    _name: displayName || getComponentNameFromKey(componentName, overrides),
    _category: category,
    _version: version,
    _versions: versions,
    _fields: fields,
    _fieldSettings: mergedFieldSettings,
    ...(softComponent.rootProps || {}),
  };

  if (overrides.onRemodel) {
    rootProps = {
      ...rootProps,
      ...overrides.onRemodel(componentName),
    };
  }

  // Reconstruct component tree from soft components
  const content = reconstructComponents(
    softComponent.components,
    componentConfigs,
    componentProps
  );

  return {
    root: {
      props: {
        title: "Soft Component Builder",
        ...rootProps,
      },
    },
    content,
  };
};
