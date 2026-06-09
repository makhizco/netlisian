"use client";

import React, { useState } from "react";
import { PuckifyCompiler } from "../../compiler/puckify-compiler";
import { ConversionResult } from "../../types";

export function ComponentConverter() {
  const [sourceCode, setSourceCode] = useState("");
  const [outputCode, setOutputCode] = useState("");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"json" | "typescript">(
    "json",
  );

  const handleConvert = async () => {
    if (!sourceCode.trim()) {
      setResult(null);
      return;
    }

    setIsLoading(true);
    try {
      // Create a temporary file-like structure for parsing
      const compiler = new PuckifyCompiler();

      // For browser usage, we need to parse the source directly
      // This is a simplified version - in production you'd need proper import resolution
      const ast = parseSimpleComponent(sourceCode);

      if (ast) {
        const conversionResult = generatePuckConfig(ast);
        setResult(conversionResult);

        if (outputFormat === "json") {
          setOutputCode(JSON.stringify(conversionResult.puckConfig, null, 2));
        } else {
          setOutputCode(generateTypeScriptCode(conversionResult));
        }
      }
    } catch (error) {
      console.error("Conversion error:", error);
      setResult({
        success: false,
        component: {
          name: "",
          filePath: "",
          props: [],
          isDefaultExport: false,
          source: sourceCode,
        },
        puckConfig: { fields: {}, defaultProps: {}, render: "" },
        warnings: [],
        errors: [
          error instanceof Error ? error.message : "Unknown error occurred",
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-4xl font-bold">Puckify Component Converter</h1>
        <p className="mb-6 text-gray-600">
          Convert React components to Puck configuration
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">React Component</h2>
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="Paste your React component code here..."
              className="h-96 w-full rounded border border-gray-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleConvert}
              disabled={isLoading}
              className="mt-4 w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Converting..." : "Convert to Puck Config"}
            </button>
          </div>

          {/* Output Section */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Puck Configuration</h2>
              <select
                value={outputFormat}
                onChange={(e) =>
                  setOutputFormat(e.target.value as "json" | "typescript")
                }
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="json">JSON</option>
                <option value="typescript">TypeScript</option>
              </select>
            </div>
            <textarea
              value={outputCode}
              readOnly
              placeholder="Generated Puck configuration will appear here..."
              className="h-96 w-full rounded border border-gray-300 bg-gray-50 p-3 font-mono text-sm"
            />
            {outputCode && (
              <button
                onClick={() => navigator.clipboard.writeText(outputCode)}
                className="mt-4 w-full rounded bg-gray-600 px-4 py-2 font-medium text-white hover:bg-gray-700"
              >
                Copy to Clipboard
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="mt-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">
              {result.success
                ? "✅ Conversion Successful"
                : "❌ Conversion Failed"}
            </h3>

            {result.component.name && (
              <div className="mb-4">
                <p className="font-medium">Component Name:</p>
                <p className="text-gray-600">{result.component.name}</p>
              </div>
            )}

            {result.component.props.length > 0 && (
              <div className="mb-4">
                <p className="font-medium">Props Detected:</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  {result.component.props.map((prop) => (
                    <li key={prop.name}>
                      - {prop.name}:{" "}
                      <code className="text-blue-600">{prop.type}</code>{" "}
                      {prop.required && <span className="text-red-600">*</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="mb-4 rounded-lg bg-yellow-50 p-3">
                <p className="font-medium text-yellow-800">Warnings:</p>
                <ul className="mt-2 space-y-1 text-yellow-700">
                  {result.warnings.map((warning, i) => (
                    <li key={i}>- {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="rounded-lg bg-red-50 p-3">
                <p className="font-medium text-red-800">Errors:</p>
                <ul className="mt-2 space-y-1 text-red-700">
                  {result.errors.map((error, i) => (
                    <li key={i}>- {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Simplified component parsing for browser environment
function parseSimpleComponent(code: string) {
  const componentNameMatch = code.match(
    /(?:export\s+(?:default\s+)?)?(?:function|const)\s+(\w+)/,
  );
  const componentName = componentNameMatch?.[1] || "Component";

  // Extract props interface/type
  const propsMatch = code.match(/(?:interface|type)\s+\w*Props\s*\{([^}]*)\}/s);
  const props = [];

  if (propsMatch) {
    const propsContent = propsMatch[1];
    const propMatches = propsContent.matchAll(/(\w+)\s*\??:\s*([^;]+);/g);

    for (const match of propMatches) {
      props.push({
        name: match[1],
        type: match[2].trim(),
        required: !match[0].includes("?"),
      });
    }
  }

  return {
    name: componentName,
    props,
    source: code,
  };
}

function generatePuckConfig(component: any) {
  const fields: Record<string, any> = {};
  const defaultProps: Record<string, any> = {};

  const typeMap: Record<string, string> = {
    string: "text",
    number: "number",
    boolean: "checkbox",
    "React.ReactNode": "rich-text",
  };

  for (const prop of component.props) {
    const fieldType = typeMap[prop.type] || "custom";
    fields[prop.name] = {
      type: fieldType,
      label: prop.name.replace(/([A-Z])/g, " $1").trim(),
    };

    if (!prop.required) {
      defaultProps[prop.name] = null;
    }
  }

  return {
    success: true,
    component,
    puckConfig: {
      fields,
      defaultProps,
      render: `export default function Render(props: any) {
  return <${component.name} {...props} />;
}`,
    },
    warnings: [],
    errors: [],
  };
}

function generateTypeScriptCode(result: any): string {
  const { component, puckConfig } = result;

  return `import { ComponentConfig } from "@puckeditor/core";

export const ${component.name}Config: ComponentConfig = {
  fields: ${JSON.stringify(puckConfig.fields, null, 2)},
  defaultProps: ${JSON.stringify(puckConfig.defaultProps, null, 2)},
  render: ({ ...props }) => {
    // Render implementation
    return <${component.name} {...props} />;
  },
};`;
}
