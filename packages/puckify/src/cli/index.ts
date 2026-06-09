#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import glob from "fast-glob";
import colors from "picocolors";
import Table from "cli-table";
import { PuckifyCompiler } from "../compiler/puckify-compiler";
import { cosmiconfig } from "cosmiconfig";
import { PuckifyConfig } from "../types";

const moduleName = "puckify";

interface ConvertOptions {
  input: string;
  output?: string;
  config?: string;
  format?: "json" | "typescript";
  recursive?: boolean;
  verbose?: boolean;
}

async function loadConfig(configPath?: string): Promise<Partial<PuckifyConfig>> {
  const explorer = cosmiconfig(moduleName);

  try {
    if (configPath) {
      const config = await explorer.load(configPath);
      return config?.config || {};
    }

    const config = await explorer.search();
    return config?.config || {};
  } catch {
    return {};
  }
}

async function convertFile(
  filePath: string,
  compiler: PuckifyCompiler,
  options: ConvertOptions
): Promise<any> {
  try {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const result = await compiler.compile(filePath);

    if (options.verbose) {
      console.log(colors.dim(`✓ Processed: ${filePath}`));
    }

    return { filePath, result };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (options.verbose) {
      console.log(colors.red(`✗ Error: ${filePath}`));
      console.log(colors.dim(`  ${errorMessage}`));
    }
    return { filePath, error: errorMessage };
  }
}

async function handleConvert(argv: any): Promise<void> {
  const config = await loadConfig(argv.config);
  const compiler = new PuckifyCompiler(config);
  const format = argv.format || (config.output?.format as any) || "json";

  try {
    // Resolve input path
    const inputPath = resolve(argv.input);

    let filesToProcess: string[] = [];

    // Check if input is directory or file
    const isDirectory = !inputPath.includes(".");
    if (isDirectory || argv.recursive) {
      filesToProcess = await glob(`${inputPath}/**/*.tsx`, {
        absolute: true,
      });
    } else {
      filesToProcess = [inputPath];
    }

    if (filesToProcess.length === 0) {
      console.log(colors.yellow("No files found to process"));
      return;
    }

    console.log(
      colors.bold(`Converting ${filesToProcess.length} component(s)...\n`)
    );

    const results = [];

    for (const file of filesToProcess) {
      const result = await convertFile(file, compiler, argv);
      results.push(result);
    }

    // Display results table
    const table = new Table({
      head: [
        colors.bold("File"),
        colors.bold("Status"),
        colors.bold("Component"),
        colors.bold("Props"),
      ],
      colWidths: [40, 12, 20, 10],
    });

    for (const { filePath, result, error } of results) {
      const fileName = filePath.split("/").pop() || filePath;
      if (error) {
        table.push([fileName, colors.red("Error"), "—", "—"]);
      } else {
        const status = result.success ? colors.green("✓") : colors.yellow("⚠");
        const componentName = result.component.name || "Unknown";
        const propsCount = result.component.props.length;
        table.push([fileName, status, componentName, propsCount.toString()]);
      }
    }

    console.log(table.toString());

    // Handle output
    if (argv.output) {
      const outputPath = resolve(argv.output);

      if (filesToProcess.length === 1) {
        // Single file - write converted config
        const result = results[0].result;
        let output = "";

        if (format === "typescript") {
          const generator = new (require("../compiler/lib/puck-generator")
            .PuckGenerator)();
          output = generator.toTypeScript(
            result.puckConfig,
            result.component.name
          );
        } else {
          output = JSON.stringify(result.puckConfig, null, 2);
        }

        writeFileSync(outputPath, output);
        console.log(
          colors.green(`\n✓ Output written to: ${colors.bold(outputPath)}`)
        );
      } else {
        // Multiple files - write index file with all configs
        const configs = results
          .filter((r) => !r.error && r.result.success)
          .map((r) => ({
            component: r.result.component.name,
            config: r.result.puckConfig,
            file: r.filePath,
          }));

        const output = JSON.stringify(configs, null, 2);
        writeFileSync(outputPath, output);
        console.log(
          colors.green(
            `\n✓ ${configs.length} configs written to: ${colors.bold(outputPath)}`
          )
        );
      }
    } else {
      // Output to console
      console.log(colors.bold("\n--- Generated Configurations ---\n"));
      for (const { result } of results) {
        if (result.success) {
          console.log(colors.cyan(`// ${result.component.name}`));
          if (format === "typescript") {
            const generator = new (require("../compiler/lib/puck-generator")
              .PuckGenerator)();
            console.log(
              generator.toTypeScript(result.puckConfig, result.component.name)
            );
          } else {
            console.log(JSON.stringify(result.puckConfig, null, 2));
          }
          console.log();
        }
      }
    }
  } catch (error) {
    console.error(
      colors.red("Fatal error:"),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// CLI Setup
yargs(hideBin(process.argv))
  .command(
    "convert",
    "Convert React components to Puck config",
    (y: import("yargs").Argv) => {
      return y
        .option("input", {
          alias: "i",
          describe: "Input file or directory path",
          type: "string",
          demandOption: true,
        })
        .option("output", {
          alias: "o",
          describe: "Output file path (optional, prints to console if omitted)",
          type: "string",
        })
        .option("config", {
          alias: "c",
          describe: "Path to puckify config file",
          type: "string",
        })
        .option("format", {
          alias: "f",
          describe: "Output format",
          type: "string",
          choices: ["json", "typescript"],
        })
        .option("recursive", {
          alias: "r",
          describe: "Recursively process directory",
          type: "boolean",
        })
        .option("verbose", {
          alias: "v",
          describe: "Verbose output",
          type: "boolean",
        });
    },
    handleConvert
  )
  .demandCommand(1, "Please provide a command")
  .help()
  .alias("help", "h")
  .version("0.0.0").argv;
