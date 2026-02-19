// Utility to generate field options recursively for select fields
// Used for both "to" and "from" field mapping
import type { Field } from "@measured/puck";

/**
 * Recursively generates options for select fields from a nested field structure.
 * @param fields The root fields object
 * @param prefix The prefix for dot notation (used internally)
 * @returns Array of { label, value } for select options
 */
export function generateFieldOptions(
  fields: Record<string, Field>,
  selectedFields: string[],
  prefix = ""
): Array<{ label: string; value: string; type: Field["type"] | "reference" }> {
  const opts: Array<{ label: string; value: string; type: Field["type"] | "reference" }> = [];
  function recurse(current: Record<string, Field>, prefix: string) {
    Object.entries(current).forEach(([key, fld]) => {
      if (fld.type === "slot") return;
      if (key === "_map") return;
      if (key === "_slotEnabled") return;
      const path = prefix ? `${prefix}.${key}` : key;
      if (selectedFields.includes(path)) {
        return;
      }
      opts.push({ label: path, value: path, type: fld.type });
      if (fld.type === "object" && fld.objectFields) {
        recurse(fld.objectFields, path);
      }
      if (fld.type === "array" && fld.arrayFields) {
        recurse(fld.arrayFields, path);
      }
    });
  }
  recurse(fields, prefix);
  return opts;
}

export function generateDynamicFieldOptions(
  _fields?: {
    name: string;
    type: Field["type"] | "reference";
  }[],
  _fieldSettings?: Record<
    string,
    {
      label: string;
      defaultValue?: any;
      options?: { label: string; value: string }[];
      subFields?: { name: string; type: Field["type"] | "reference" }[];
      subFieldSettings?: Record<
        string,
        {
          label: string;
          defaultValue?: any;
          options?: { label: string; value: string }[];
          subFields?: { name: string; type: Field["type"] | "reference" }[];
        }
      >;
    }
  >,
  prefix: string = ""
): Array<{ label: string; value: string; type: Field["type"] | "reference" }> {
  const opts: Array<{ label: string; value: string; type: Field["type"] | "reference" }> = [];

  if (!_fields || !_fieldSettings) return opts;
  function recurse(
    fields: NonNullable<typeof _fields>,
    fieldSettings: NonNullable<typeof _fieldSettings>,
    currentPrefix: string
  ) {
    fields.forEach((field) => {
      const settings = fieldSettings[field.name];

      const path = currentPrefix
        ? `${currentPrefix}.${field.name}`
        : field.name;

      opts.push({ label: path, value: path, type: field.type });

      // Handle subfields if they exist
      if (settings?.subFields?.length) {
        recurse(settings.subFields, settings.subFieldSettings || {}, path);
      }
    });
  }

  recurse(_fields, _fieldSettings, prefix);
  return opts;
}
