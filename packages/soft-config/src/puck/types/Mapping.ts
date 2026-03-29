import type { Field } from "@measured/puck";

export type MapEntry = {
  from?: string | string[];
  to?: string | string[];
  transform?: (values: any[], props: any) => any;
  unmappedArrayItemDefaultValues?: Record<string, any>;
  /** @deprecated in favour of unmappedArrayItemDefaultValues – kept for back-compat */
  defaultOverrides?: Record<string, any>;
  [key: string]: any;
};

export type ApplyMappingResult = {
  newProps: Record<string, any>;
  mappedArrayPaths: Set<string>;
  changed: boolean;
};

export type ApplyMappingOptions = {
  sourceProps?: Record<string, any>;
  arrayDefaults?: Record<string, any[]>;
};

export type MappingOption = {
  label: string;
  value: string;
  type: Field["type"] | "reference";
};
