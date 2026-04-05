import type { Field, Fields } from "@measured/puck";

export type BuiltInSoftFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "array"
  | "object"
  | "reference";

export type SoftFieldType = BuiltInSoftFieldType | string;

export type CustomFieldReturnType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export type SoftFieldDefinition = {
  name: string;
  type: SoftFieldType;
};

export type FieldOption = {
  label: string;
  value: string | number | boolean | object | null | undefined;
};

interface SharedFieldSettings<TSubFieldSettings> {
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: FieldOption[];
  summary?: string;
  summaryField?: string;
  summaryExpression?: string;
  subFields?: SoftFieldDefinition[];
  subFieldSettings?: TSubFieldSettings;
  customFieldType?: string;
  customFieldReturnType?: CustomFieldReturnType;
}

export interface SoftFieldSettingsEntry
  extends SharedFieldSettings<SoftFieldSettings> {}

export type SoftFieldSettings = Record<
  string,
  SoftFieldSettingsEntry
>;

export interface FieldSettingsEntry
  extends SharedFieldSettings<FieldSettings> {
  label: string;
}

export type FieldSettings = Record<string, FieldSettingsEntry>;

export type CustomFieldSettingsOverrideProps = {
  fieldName: string;
  fieldType: string;
  fieldSettings?: SoftFieldSettingsEntry;
  originalFieldSettings: Fields;
};

export type CustomFieldDefinition = {
  field: Field;
  returnType: CustomFieldReturnType;
  subFields?: SoftFieldDefinition[];
  subFieldSettings?: SoftFieldSettings;
  fieldSettingsOverride?: (
    props: CustomFieldSettingsOverrideProps
  ) => Fields;
};

export type CustomFields = Record<string, CustomFieldDefinition>;
