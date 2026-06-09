import {
  PuckifyCompilerOptions,
  PuckifyConfig,
  ConversionResult,
  PuckComponentConfig,
} from "../types";
import { ASTParser } from "./lib/ast-parser";
import { PuckGenerator } from "./lib/puck-generator";
import { ShadcnDetector } from "./lib/shadcn-detector";

const DEFAULT_OPTIONS: PuckifyCompilerOptions = {
  targetLibrary: "auto",
  includeStyles: true,
  generateFieldHelpers: true,
  resolveImports: true,
};

export class PuckifyCompiler {
  private options: PuckifyCompilerOptions;
  private astParser: ASTParser;
  private puckGenerator: PuckGenerator;
  private shadcnDetector: ShadcnDetector;

  constructor(config?: Partial<PuckifyConfig>) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...config?.compiler,
    };
    this.astParser = new ASTParser();
    this.puckGenerator = new PuckGenerator();
    this.shadcnDetector = new ShadcnDetector();
  }

  async compile(filePath: string): Promise<ConversionResult> {
    try {
      // Parse the component
      const componentMetadata = this.astParser.parseComponent(filePath);

      // Detect if it's a shadcn component
      const isShadcn = this.shadcnDetector.isShadcnComponent(componentMetadata);
      const shadcnType = isShadcn
        ? this.shadcnDetector.getShadcnComponentType(componentMetadata)
        : null;

      // Generate Puck config
      const puckConfig = this.puckGenerator.generateConfig(componentMetadata, {
        generateFieldHelpers: this.options.generateFieldHelpers,
      });

      // Enhance fields for shadcn components
      if (isShadcn && shadcnType) {
        this.enhanceShadcnFields(puckConfig, componentMetadata, shadcnType);
      }

      return {
        success: true,
        component: componentMetadata,
        puckConfig,
        warnings: isShadcn
          ? []
          : ["Component is not recognized as a shadcn component"],
        errors: [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        component: {
          name: filePath,
          filePath,
          props: [],
          isDefaultExport: false,
          source: "",
        },
        puckConfig: { fields: {}, defaultProps: {}, render: "" },
        warnings: [],
        errors: [errorMessage],
      };
    }
  }

  private enhanceShadcnFields(
    config: PuckComponentConfig,
    componentMetadata: any,
    shadcnType: string
  ): void {
    // Enhance field types for known shadcn components
    for (const [propName, field] of Object.entries(config.fields)) {
      const prop = componentMetadata.props.find(
        (p: any) => p.name === propName
      );
      if (prop) {
        const optimalType = this.shadcnDetector.getOptimalFieldTypeForShadcn(
          propName,
          prop.type,
          shadcnType
        );
        (field as any).type = optimalType;
      }
    }
  }

  setOptions(options: Partial<PuckifyCompilerOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getOptions(): PuckifyCompilerOptions {
    return { ...this.options };
  }
}
