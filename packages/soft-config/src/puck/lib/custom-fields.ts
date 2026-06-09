import type { Field } from "@puckeditor/core";
import type {
  BuiltInSoftFieldType,
  CustomFieldDefinition,
  CustomFields,
  CustomFieldReturnType,
  SoftFieldDefinition,
  SoftFieldSettings,
  SoftFieldType,
} from "../types/SoftFields";

const builtInSoftFieldTypes = new Set<BuiltInSoftFieldType>([
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "array",
  "object",
  "reference",
]);

const warnedMessages = new Set<string>();

const warnOnce = (message: string): void => {
  if (warnedMessages.has(message)) {
    return;
  }

  warnedMessages.add(message);
  console.warn(message);
};

export const isBuiltInSoftFieldType = (
  fieldType: string
): fieldType is BuiltInSoftFieldType => {
  return builtInSoftFieldTypes.has(fieldType as BuiltInSoftFieldType);
};

export const resolveCustomFieldDefinition = (
  fieldType: SoftFieldType,
  customFields?: CustomFields
): CustomFieldDefinition | undefined => {
  if (isBuiltInSoftFieldType(fieldType)) {
    return undefined;
  }

  return customFields?.[fieldType];
};

export const resolveCustomFieldReturnType = (
  fieldType: SoftFieldType,
  customFields?: CustomFields
): CustomFieldReturnType | null => {
  const customField = resolveCustomFieldDefinition(fieldType, customFields);

  if (!customField) {
    return null;
  }

  if (!customField.returnType) {
    warnOnce(
      `[soft-config] Custom field "${fieldType}" is missing a required returnType and will be skipped from mapping options.`
    );
    return null;
  }

  return customField.returnType;
};

export const resolveCustomFieldSchema = (
  fieldType: SoftFieldType,
  customFields?: CustomFields
): {
  subFields: SoftFieldDefinition[];
  subFieldSettings: SoftFieldSettings;
} | null => {
  const customField = resolveCustomFieldDefinition(fieldType, customFields);
  if (!customField) {
    return null;
  }

  const returnType = resolveCustomFieldReturnType(fieldType, customFields);
  if (!returnType) {
    return null;
  }

  if (returnType !== "array" && returnType !== "object") {
    return null;
  }

  const subFields = customField.subFields || [];
  if (!subFields.length) {
    warnOnce(
      `[soft-config] Custom field "${fieldType}" returns ${returnType} but does not define subFields. It will be skipped from mapping options.`
    );
    return null;
  }

  return {
    subFields,
    subFieldSettings: customField.subFieldSettings || {},
  };
};

export type CustomFieldTypeOption = {
  label: string;
  value: string;
};

// Prefer the custom field label in selectors, with key fallback.
export const getCustomFieldTypeOptions = (
  customFields?: CustomFields
): CustomFieldTypeOption[] => {
  if (!customFields) {
    return [];
  }

  return Object.entries(customFields)
    .filter(([fieldType]) => !isBuiltInSoftFieldType(fieldType))
    .map(([fieldType, definition]) => ({
      label:
        typeof definition.field.label === "string" && definition.field.label
          ? definition.field.label
          : fieldType,
      value: fieldType,
    }));
};

export const mapCustomReturnTypeToMappingType = (
  returnType: CustomFieldReturnType
): Field["type"] => {
  switch (returnType) {
    case "string":
      return "textarea";
    case "number":
      return "number";
    case "boolean":
      return "select";
    case "array":
      return "array";
    case "object":
      return "object";
    default:
      return "textarea";
  }
};

export const isCustomFieldType = (
  fieldType: SoftFieldType,
  customFields?: CustomFields
): boolean => {
  return !isBuiltInSoftFieldType(fieldType) && Boolean(customFields?.[fieldType]);
};

export const getCustomFieldTypeFromMeta = (
  fieldType: SoftFieldType,
  metadataType?: string
): string | null => {
  if (metadataType) {
    return metadataType;
  }

  if (isBuiltInSoftFieldType(fieldType)) {
    return null;
  }

  return fieldType;
};
