import type { Field } from "@measured/puck";

export type MapEntry = {
  mode?: "simple" | "cva";
  from?: string | string[];
  to?: string | string[];
  cva?: {
    base?: string;
    variants?: Array<{
      fieldId?: string;
      classes?: Record<string, string>;
    }>;
  };
  transform?: (
    values: unknown[],
    props: Record<string, unknown>
  ) => unknown;
  unmappedArrayItemDefaultValues?: Record<string, unknown>;
  /** @deprecated in favour of unmappedArrayItemDefaultValues – kept for back-compat */
  defaultOverrides?: Record<string, unknown>;
};

export type ApplyMappingResult = {
  newProps: Record<string, unknown>;
  mappedArrayPaths: Set<string>;
  changed: boolean;
};

export type ApplyMappingOptions = {
  sourceProps?: Record<string, unknown>;
  arrayDefaults?: Record<string, unknown[]>;
};

export type MappingOption = {
  label: string;
  value: string;
  type: Field["type"] | "reference";
};
