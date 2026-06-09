"use client";
import type { Field } from "@measured/puck";
import type { MappingOption } from "../../types/Mapping";
import type {
  CustomFields,
  SoftFieldDefinition,
  SoftFieldSettings,
} from "../../types/SoftFields";
import {
  isBuiltInSoftFieldType,
  mapCustomReturnTypeToMappingType,
  resolveCustomFieldReturnType,
  resolveCustomFieldSchema,
} from "../custom-fields";
import { componentLabelFromName } from "../component-key";

const formatPathLabel = (path: string) => {
  return path
    .split(".")
    .map((part) => {
      if (part.endsWith("[]")) {
        return componentLabelFromName(part.slice(0, -2)) + "[]";
      }
      return componentLabelFromName(part);
    })
    .join(" . ");
};

const hasArrayMappingPath = (value: string) => value.includes("[]");

const isBareArrayPath = (value: string) =>
  !hasArrayMappingPath(value) && !value.includes(".");

/**
 * Filters toOptions based on the selected fromPath.
 * - If fromPath contains an array segment, only return array-path to-options.
 * - If fromPath is a bare array, only return bare array to-options.
 * - Otherwise, hide array-path to-options (prevent array-to-scalar mismatches).
 */
export function filterToOptionsForFrom(
  fromPath: string | undefined,
  toOptions: MappingOption[],
): MappingOption[] {
  if (!fromPath) return toOptions;

  const fromHasArrayMapping = hasArrayMappingPath(fromPath);
  const fromIsBareArray = isBareArrayPath(fromPath);

  return toOptions.filter((option) => {
    const optionHasArrayMapping = hasArrayMappingPath(option.value);

    if (fromHasArrayMapping) {
      return optionHasArrayMapping;
    }

    if (fromIsBareArray) {
      return isBareArrayPath(option.value);
    }

    return !optionHasArrayMapping;
  });
}

/**
 * Recursively generates options for select fields from a nested field structure.
 * @param fields The root fields object
 * @param prefix The prefix for dot notation (used internally)
 * @returns Array of { label, value } for select options
 */
export function generateFieldOptions(
  fields: Record<string, Field>,
  prefix = "",
): MappingOption[] {
  const opts: MappingOption[] = [];
  function recurse(current: Record<string, Field>, prefix: string) {
    Object.entries(current).forEach(([key, fld]) => {
      if (fld.type === "slot") return;
      if (key === "_map") return;
      if (key === "_slotEnabled") return;
      
      const path = prefix ? `${prefix}.${key}` : key;
      if (fld.type === "object" && fld.objectFields) {
        recurse(fld.objectFields, path);
      } else if (fld.type === "array" && fld.arrayFields) {
        recurse(fld.arrayFields, 
          path + "[]"
        );
      } else {
        opts.push({ label: formatPathLabel(path), value: path, type: fld.type });
      }
    });
  }
  recurse(fields, prefix);
  return opts;
}

export function generateDynamicFieldOptions(
  _fields: SoftFieldDefinition[] | undefined,
  _fieldSettings: SoftFieldSettings | undefined,
  customFields?: CustomFields,
  prefix = "",
): MappingOption[] {
  const opts: MappingOption[] = [];

  if (!_fields) return opts;

  function recurse(
    fields: SoftFieldDefinition[],
    fieldSettings: SoftFieldSettings,
    currentPrefix: string,
  ) {
    fields.forEach((field) => {
      const settings = fieldSettings[field.name];
      const customReturnType = resolveCustomFieldReturnType(
        field.type,
        customFields
      );

      const path = currentPrefix
        ? `${currentPrefix}.${field.name}`
        : field.name;

      if (customReturnType) {
        if (customReturnType === "array" || customReturnType === "object") {
          const customSchema = resolveCustomFieldSchema(field.type, customFields);
          if (!customSchema) {
            return;
          }

          recurse(
            customSchema.subFields,
            customSchema.subFieldSettings,
            path + (customReturnType === "array" ? "[]" : "")
          );
          return;
        }

        opts.push({
          label: formatPathLabel(path),
          value: path,
          type: mapCustomReturnTypeToMappingType(customReturnType),
        });
        return;
      }

      if (!isBuiltInSoftFieldType(field.type)) {
        return;
      }

      // Handle subfields if they exist
      if (settings?.subFields?.length) {

        recurse(
          settings.subFields,
          settings.subFieldSettings || {},
          path + (field.type === "array" ? "[]" : "")
        );
      } else if (field.type !== "array" && field.type !== "object") {
        opts.push({ label: formatPathLabel(path), value: path, type: field.type });
      }
    });
  }

  recurse(_fields, _fieldSettings || {}, prefix);

  return opts;
}
