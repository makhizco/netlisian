import { getFieldSettingsByPath } from "./get-settings-by-path";
import type { SoftFieldDefinition, SoftFieldSettings } from "../types/SoftFields";

const primitiveFieldTypes = new Set<SoftFieldDefinition["type"]>([
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "reference",
]);

const isPrimitiveValue = (value: unknown): boolean =>
  ["string", "number", "boolean"].includes(typeof value);

const getFallbackValueForField = (type: SoftFieldDefinition["type"]) => {
  switch (type) {
    case "number":
      return 0;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
};

const resolveExpressionSummary = (
  item: Record<string, any>,
  index: number,
  expression?: string
) => {
  if (!expression) return "";

  let isValid = true;

  const result = expression.replace(/\{([^}]+)\}/g, (_match, token: string) => {
    if (token === "index") {
      return String(index);
    }

    if (token.startsWith("item.")) {
      const value = getFieldSettingsByPath(item, token.slice(5));
      if (isPrimitiveValue(value)) {
        return String(value);
      }
    }

    isValid = false;
    return "";
  });

  return isValid ? result : "";
};

export const isPrimitiveFieldType = (type: SoftFieldDefinition["type"]) =>
  primitiveFieldTypes.has(type);

export const buildArrayDefaultItemProps = (
  subFields: SoftFieldDefinition[] = [],
  subFieldSettings: SoftFieldSettings = {}
) => {
  if (!subFields.length) return undefined;

  const item: Record<string, any> = {};
  let hasValue = false;

  subFields.forEach((subField) => {
    const settings = subFieldSettings[subField.name];
    if (
      settings &&
      Object.prototype.hasOwnProperty.call(settings, "defaultValue") &&
      settings.defaultValue !== undefined
    ) {
      item[subField.name] = settings.defaultValue;
      hasValue = true;
      return;
    }

    item[subField.name] = getFallbackValueForField(subField.type);
    hasValue = true;
  });

  return hasValue ? item : undefined;
};

export const buildArrayDefaultValue = (
  subFields: SoftFieldDefinition[] = [],
  subFieldSettings: SoftFieldSettings = {}
) => {
  const item = buildArrayDefaultItemProps(subFields, subFieldSettings);

  return item ? [item] : [];
};

export const getArrayItemSummary = (
  item: Record<string, any>,
  index = 0,
  settings?: SoftFieldSettings[string]
) => {
  if (settings?.summary === "field" && settings.summaryField) {
    const value = getFieldSettingsByPath(item, settings.summaryField);
    if (isPrimitiveValue(value) && String(value).length > 0) {
      return String(value);
    }

    return `Item ${(index || 0) + 1}`;
  }

  if (settings?.summary === "expression") {
    const summary = resolveExpressionSummary(
      item,
      index,
      settings.summaryExpression
    );
    return summary || `Item ${(index || 0) + 1}`;
  }

  return `Item ${(index || 0) + 1}`;
};

// A valid array mapping path includes an array segment, e.g. "items[].fieldName"
export const isArrayMappingPath = (path: string): boolean => {
  return typeof path === "string" && /^[^.]+\[\]\.[^.]+$/.test(path);
};

// Back-compat alias for older imports.
export const isArrayItemMappingPath = isArrayMappingPath;

export const getArrayBasePath = (arrayPath: string): string | null => {
  if (!isArrayMappingPath(arrayPath)) return null;

  const match = arrayPath.match(/^([^.]+)\[\]\./);
  return match ? match[1] : null;
};

export const getArrayItemSubPath = (arrayPath: string): string | null => {
  if (!isArrayMappingPath(arrayPath)) return null;

  const match = arrayPath.match(/\[\]\.(.+)$/);
  return match ? match[1] : null;
};
