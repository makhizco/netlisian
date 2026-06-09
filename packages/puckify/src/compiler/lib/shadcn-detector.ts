import { ComponentMetadata } from "../../types";

/**
 * Detects and handles shadcn component patterns
 */
export class ShadcnDetector {
  isShadcnComponent(metadata: ComponentMetadata): boolean {
    // Check if component imports from shadcn
    const shadcnImportPattern = /@\/components\/ui|shadcn\/ui/;
    return shadcnImportPattern.test(metadata.source);
  }

  getShadcnComponentType(
    metadata: ComponentMetadata
  ): string | null {
    // Extract component type from filename or component name
    const name = metadata.name.toLowerCase();

    const commonShadcnComponents = [
      "button",
      "input",
      "select",
      "textarea",
      "checkbox",
      "radio",
      "toggle",
      "slider",
      "switch",
      "dialog",
      "alert",
      "badge",
      "card",
      "form",
      "table",
      "tabs",
      "accordion",
      "dropdown-menu",
      "context-menu",
      "popover",
      "tooltip",
      "scroll-area",
      "sheet",
      "sidebar",
      "command",
      "breadcrumb",
      "pagination",
      "progress",
      "skeleton",
    ];

    for (const component of commonShadcnComponents) {
      if (name.includes(component)) {
        return component;
      }
    }

    return null;
  }

  getOptimalFieldTypeForShadcn(
    propName: string,
    propType: string,
    componentType: string | null
  ): string {
    const propLower = propName.toLowerCase();

    // Common shadcn patterns
    if (
      propLower === "disabled" ||
      propLower === "readonly" ||
      propLower === "checked"
    ) {
      return "checkbox";
    }

    if (
      propLower === "placeholder" ||
      propLower === "label" ||
      propLower === "title"
    ) {
      return "text";
    }

    if (
      propLower === "size" ||
      propLower === "variant" ||
      propLower === "align"
    ) {
      return "select";
    }

    if (propLower === "children") {
      return "rich-text";
    }

    // Fallback based on type
    if (propType.includes("boolean")) return "checkbox";
    if (propType.includes("string")) return "text";
    if (propType.includes("number")) return "number";

    return "custom";
  }
}
