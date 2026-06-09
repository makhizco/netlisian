import {
  ComponentMetadata,
  PuckComponentConfig,
  PuckFieldConfig,
} from "../../types";

const FIELD_TYPE_MAP: Record<string, string> = {
  string: "text",
  number: "number",
  boolean: "checkbox",
  "boolean | undefined": "checkbox",
  "string | undefined": "text",
  "number | undefined": "number",
};

export class PuckGenerator {
  generateConfig(
    metadata: ComponentMetadata,
    options: { generateFieldHelpers?: boolean } = {}
  ): PuckComponentConfig {
    const fields: Record<string, PuckFieldConfig> = {};
    const defaultProps: Record<string, unknown> = {};

    for (const prop of metadata.props) {
      const fieldType = FIELD_TYPE_MAP[prop.type] || "custom";

      fields[prop.name] = {
        type: fieldType,
        label: this.formatLabel(prop.name),
        help: prop.description,
      };

      if (!prop.required) {
        defaultProps[prop.name] = prop.default ?? this.getDefaultValue(
          prop.type
        );
      }
    }

    return {
      fields,
      defaultProps,
      render: this.generateRenderCode(metadata),
    };
  }

  private formatLabel(name: string): string {
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private getDefaultValue(type: string): unknown {
    switch (type) {
      case "string":
      case "string | undefined":
        return "";
      case "number":
      case "number | undefined":
        return 0;
      case "boolean":
      case "boolean | undefined":
        return false;
      default:
        return null;
    }
  }

  private generateRenderCode(metadata: ComponentMetadata): string {
    const componentName = metadata.name;
    return `
import { ${componentName} } from "@/components/ui/${componentName.toLowerCase()}";

export default function Render(props: any) {
  return <${componentName} {...props} />;
}
    `.trim();
  }

  toTypeScript(config: PuckComponentConfig, componentName: string): string {
    const fieldsStr = JSON.stringify(config.fields, null, 2);
    const defaultPropsStr = JSON.stringify(config.defaultProps, null, 2);

    return `
import { ComponentConfig } from "@measured/puck";

export const ${componentName}Config: ComponentConfig = {
  fields: ${fieldsStr},
  defaultProps: ${defaultPropsStr},
  render: ({ ...props }) => {
    // Render implementation
    return null;
  },
};
    `.trim();
  }

  toJSON(config: PuckComponentConfig): string {
    return JSON.stringify(config, null, 2);
  }
}
