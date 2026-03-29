import type { Field } from "@measured/puck";

export type SoftFieldDefinition = {
  name: string;
  type: Field["type"] | "reference";
};

export type FieldOption = {
  label: string;
  value: string;
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
