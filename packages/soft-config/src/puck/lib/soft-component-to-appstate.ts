import { AppState, ComponentData, ComponentDataOptionalId, Config, Fields } from "@measured/puck";
import { SoftSubComponent } from "../types/SoftComponent";
import { VersionedSoftComponent } from "../types/SoftComponent";
import { generateId } from "./generate-id";
import { BuilderRootConfig } from "../types/BuilderConfig";
import { getFieldSettingsByPath } from "./get-settings-by-path";
import { setPropertyByPath } from "./set-prop-by-path";
import { getComponentNameFromKey } from "./component-key";
import { Overrides } from "../types/Overrides";

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
    // Start with fixed props
    const props: Record<string, any> = {
      ...subComponent.fixedProps,
    };

    // Map soft component props to component props using the mapping
    subComponent.map?.forEach((mapItem, i) => {
      const { from, to, transform } = mapItem || {};
      const fromPaths = Array.isArray(from) ? from : from ? [from] : [];
      const toPaths = Array.isArray(to) ? to : to ? [to] : [];

      const inputs = fromPaths.map((path) =>
        getFieldSettingsByPath(softComponentProps || {}, path)
      );

      const runner = transform
      const result = runner ? runner(inputs, softComponentProps) : inputs[0];

      if (Array.isArray(result)) {
        result.forEach((val, idx) => {
          if (toPaths[idx]) setPropertyByPath(props, toPaths[idx], val);
        });
      } else {
        toPaths.forEach((toPath) =>
          setPropertyByPath(props, toPath, result));
      }

      if (transform && props._map?.[i]) {
        props._map[i].transform = transform;
      }
    });

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

  // Set default values from soft component
  Object.entries(softComponent.defaultProps).forEach(([key, value]) => {
    if (fieldSettings && fieldSettings[key] && !slots.has(key)) {
      fieldSettings[key].defaultValue = value;
    }
  });

  // Build root props for the builder
  let rootProps: BuilderRootConfig = {
    _name: displayName || getComponentNameFromKey(componentName, overrides),
    _category: category,
    _version: version,
    _versions: versions,
    _fields: fields,
    _fieldSettings: fieldSettings,
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
