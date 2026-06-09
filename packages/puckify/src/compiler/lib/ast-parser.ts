import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { ComponentMetadata, PropDefinition } from "../../types";
import { readFileSync } from "fs";

export class ASTParser {
  parseComponent(filePath: string): ComponentMetadata {
    const source = readFileSync(filePath, "utf-8");
    const ast = parser.parse(source, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators"],
    });

    const componentMetadata: ComponentMetadata = {
      name: "",
      filePath,
      props: [],
      isDefaultExport: false,
      source,
    };

    traverse(ast, {
      ExportDefaultDeclaration: (path: NodePath<t.ExportDefaultDeclaration>) => {
        componentMetadata.isDefaultExport = true;
        if (path.node.declaration.type === "FunctionDeclaration") {
          const func = path.node.declaration as t.FunctionDeclaration;
          componentMetadata.name = func.id?.name || "Component";
          this.extractPropsFromFunction(func, componentMetadata);
        } else if (path.node.declaration.type === "Identifier") {
          if (t.isIdentifier(path.node.declaration)) {
            componentMetadata.name = (path.node.declaration as t.Identifier)
              .name;
          }
        }
      },

      ExportNamedDeclaration: (path: NodePath<t.ExportNamedDeclaration>) => {
        if (path.node.declaration?.type === "FunctionDeclaration") {
          const func = path.node.declaration as t.FunctionDeclaration;
          componentMetadata.name = func.id?.name || "Component";
          this.extractPropsFromFunction(func, componentMetadata);
        }
      },
    });

    return componentMetadata;
  }

  private extractPropsFromFunction(
    func: t.FunctionDeclaration,
    metadata: ComponentMetadata
  ): void {
    if (func.params.length === 0) return;

    const param = func.params[0];

    if (t.isObjectPattern(param)) {
      const props = this.extractPropsFromPattern(param);
      metadata.props = props;
    }
  }

  private extractPropsFromPattern(pattern: t.ObjectPattern): PropDefinition[] {
    const props: PropDefinition[] = [];

    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        let name = "";
        let type = "any";

        if (t.isIdentifier(prop.key)) {
          name = prop.key.name;
        }

        // Try to extract type from TypeScript annotation
        if (
          "typeAnnotation" in prop &&
          (prop as any).typeAnnotation
        ) {
          type = this.extractTypeAnnotation(
            (prop as any).typeAnnotation as t.TypeAnnotation
          );
        }

        if (name) {
          props.push({
            name,
            type,
            required: !(prop as any).optional,
          });
        }
      }
    }

    return props;
  }

  private extractTypeAnnotation(annotation: t.TypeAnnotation): string {
    if (!annotation || !annotation.typeAnnotation) return "any";

    const typeAnnotation = annotation.typeAnnotation;

    if (t.isTSStringKeyword(typeAnnotation)) return "string";
    if (t.isTSNumberKeyword(typeAnnotation)) return "number";
    if (t.isTSBooleanKeyword(typeAnnotation)) return "boolean";
    if (t.isTSUnionType(typeAnnotation)) {
      const unionNode = typeAnnotation as t.TSUnionType;
      const types = unionNode.types
        .map((typeNode: any) => this.extractTypeAnnotation({ typeAnnotation: typeNode } as unknown as t.TypeAnnotation))
        .join(" | ");
      return types;
    }

    return "any";
  }
}
