/**
 * Type definitions for @netlisian/puckify
 */

export interface PuckifyCompilerOptions {
  targetLibrary: "shadcn" | "custom" | "auto";
  includeStyles: boolean;
  generateFieldHelpers: boolean;
  resolveImports: boolean;
}

export interface PuckifyOutputOptions {
  format: "typescript" | "javascript" | "json";
  indent: number;
  includeComments: boolean;
}

export interface PuckifyConfig {
  compiler: Partial<PuckifyCompilerOptions>;
  output: Partial<PuckifyOutputOptions>;
  exclude?: string[];
  include?: string[];
}

export interface ComponentMetadata {
  name: string;
  filePath: string;
  props: PropDefinition[];
  isDefaultExport: boolean;
  source: string;
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

export interface PuckFieldConfig {
  type: string;
  label?: string;
  default?: unknown;
  help?: string;
}

export interface PuckComponentConfig {
  fields: Record<string, PuckFieldConfig>;
  defaultProps: Record<string, unknown>;
  render: string;
}

export interface ConversionResult {
  success: boolean;
  component: ComponentMetadata;
  puckConfig: PuckComponentConfig;
  warnings: string[];
  errors: string[];
}
