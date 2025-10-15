import * as tailwindcss from "tailwindcss";

import index from "tailwindcss/index.css";
// import preflight from "tailwindcss/preflight.css";
// import theme from "tailwindcss/theme.css";
// import utilities from "tailwindcss/utilities.css";

const assets = {
  css: {
    index,
    // preflight,
    // theme,
    // utilities,
  },
};

class Instrumentation {
  start(label: string) {
    performance.mark(`${label} (start)`);
  }

  end(label: string, detail?: any) {
    performance.mark(`${label} (end)`);

    performance.measure(label, {
      start: `${label} (start)`,
      end: `${label} (end)`,
      detail,
    });
  }

  hit(label: string, detail?: any) {
    performance.mark(label, {
      detail,
    });
  }

  error(error: any) {
    performance.mark(`(error)`, {
      detail: { error: `${error}` },
    });

    throw error;
  }
}

/**
 * The type used by `<style>` tags that contain input CSS.
 */
const STYLE_TYPE = "text/tailwindcss";

/**
 * Tailwind processor instance for a specific document
 */
class TailwindProcessor {
  private compiler: Awaited<ReturnType<typeof tailwindcss.compile>> | null =
    null;
  private classes = new Set<string>();
  private lastCss = "";
  private sheet: HTMLStyleElement;
  private buildQueue = Promise.resolve();
  private nextBuildId = 1;
  private I = new Instrumentation();
  private styleObserver: MutationObserver;
  private documentObserver: MutationObserver | undefined;
  private targetDocument: Document;

  constructor(targetDocument: Document = document) {
    this.targetDocument = targetDocument;
    this.sheet = this.targetDocument.createElement("style");

    // Add id for selection
    this.sheet.id = "generated-tailwindcss";

    this.styleObserver = new MutationObserver(() => this.rebuild("full"));
    this.setupDocumentObserver();
  }

  /**
   * Initialize the Tailwind processor for the target document
   */
  async init(): Promise<void> {
    await this.rebuild("full");
    // Add a custom attribute for easier selection later
    this.sheet.setAttribute("data-tailwind-processor", "active");
    this.targetDocument.head.append(this.sheet);
  }

  /**
   * Get all classes currently detected in the document
   */
  getAllClasses(): string[] {
    return Array.from(this.classes);
  }

  /**
   * Get all unique classes from all elements with class attributes
   */
  scanAllClasses(): string[] {
    const allClasses = new Set<string>();

    for (let element of this.targetDocument.querySelectorAll("[class]")) {
      for (let c of element.classList) {
        allClasses.add(c);
      }
    }

    return Array.from(allClasses);
  }

  /**
   * Manually trigger a rebuild
   */
  async refresh(): Promise<void> {
    await this.rebuild("full");
  }

  /**
   * Destroy the processor and clean up observers
   */
  destroy(): void {
    this.styleObserver.disconnect();
    this.documentObserver?.disconnect();
    if (this.sheet.parentNode) {
      this.sheet.parentNode.removeChild(this.sheet);
    }
  }

  private async createCompiler(): Promise<void> {
    this.I.start(`Create compiler`);
    this.I.start("Reading Stylesheets");

    const stylesheets: Iterable<HTMLStyleElement> =
      this.targetDocument.querySelectorAll(`style[type="${STYLE_TYPE}"]`);

    let css = "";
    for (let sheet of stylesheets) {
      this.observeSheet(sheet);
      css += sheet.textContent + "\n";
    }

    if (!css.includes("@import")) {
      css = `@import "tailwindcss";${css}`;
    }

    this.I.end("Reading Stylesheets", {
      size: css.length,
      changed: this.lastCss !== css,
    });

    if (this.lastCss === css) return;

    this.lastCss = css;

    this.I.start("Compile CSS");
    try {
      this.compiler = await tailwindcss.compile(css, {
        base: "/",
        loadStylesheet: this.loadStylesheet.bind(this),
        loadModule: this.loadModule.bind(this),
      });
    } finally {
      this.I.end("Compile CSS");
      this.I.end(`Create compiler`);
    }

    this.classes.clear();
  }

  private async loadStylesheet(id: string, base: string) {
    function load() {
      if (id === "tailwindcss") {
        return {
          path: "virtual:tailwindcss/index.css",
          base,
          content: assets.css.index,
        };
      } else if (
        id === "tailwindcss/preflight" ||
        id === "tailwindcss/preflight.css" ||
        id === "./preflight.css"
      ) {
        return {
          path: "virtual:tailwindcss/preflight.css",
          base,
          content: "",
        };
      } else if (
        id === "tailwindcss/theme" ||
        id === "tailwindcss/theme.css" ||
        id === "./theme.css"
      ) {
        return {
          path: "virtual:tailwindcss/theme.css",
          base,
          content: "",
        };
      } else if (
        id === "tailwindcss/utilities" ||
        id === "tailwindcss/utilities.css" ||
        id === "./utilities.css"
      ) {
        return {
          path: "virtual:tailwindcss/utilities.css",
          base,
          content: "",
        };
      }

      throw new Error(`The browser build does not support @import for "${id}"`);
    }

    try {
      let sheet = load();

      this.I.hit(`Loaded stylesheet`, {
        id,
        base,
        size: sheet.content.length,
      });

      return sheet;
    } catch (err) {
      this.I.hit(`Failed to load stylesheet`, {
        id,
        base,
        error: (err as Error).message ?? err,
      });

      throw err;
    }
  }

  private async loadModule(): Promise<never> {
    throw new Error(
      `The browser build does not support plugins or config files.`
    );
  }

  private async build(kind: "full" | "incremental"): Promise<void> {
    if (!this.compiler) return;

    let newClasses = new Set<string>();

    this.I.start(`Collect classes`);

    for (let element of this.targetDocument.querySelectorAll("[class]")) {
      for (let c of element.classList) {
        if (this.classes.has(c)) continue;

        this.classes.add(c);
        newClasses.add(c);
      }
    }

    this.I.end(`Collect classes`, {
      count: newClasses.size,
    });

    if (newClasses.size === 0 && kind === "incremental") return;

    this.I.start(`Build utilities`);
    this.sheet.textContent = this.compiler.build(Array.from(newClasses));
    this.I.end(`Build utilities`);
  }

  private rebuild(kind: "full" | "incremental"): void {
    const run = async () => {
      if (!this.compiler && kind !== "full") {
        return;
      }

      let buildId = this.nextBuildId++;

      this.I.start(`Build #${buildId} (${kind})`);

      if (kind === "full") {
        await this.createCompiler();
      }

      this.I.start(`Build`);
      await this.build(kind);
      this.I.end(`Build`);

      this.I.end(`Build #${buildId} (${kind})`);
    };

    this.buildQueue = this.buildQueue
      .then(run)
      .catch((err) => this.I.error(err));
  }

  private observeSheet(sheet: HTMLStyleElement): void {
    this.styleObserver.observe(sheet, {
      attributes: true,
      attributeFilter: ["type"],
      characterData: true,
      subtree: true,
      childList: true,
    });
  }

  private setupDocumentObserver(): void {
    this.documentObserver = new MutationObserver((records) => {
      let full = 0;
      let incremental = 0;

      for (let record of records) {
        for (let node of record.addedNodes as Iterable<HTMLElement>) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.tagName !== "STYLE") continue;
          if (node.getAttribute("type") !== STYLE_TYPE) continue;

          this.observeSheet(node as HTMLStyleElement);
          full++;
        }

        for (let node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node === this.sheet) continue;
          incremental++;
        }

        if (record.type === "attributes") {
          incremental++;
        }
      }

      if (full > 0) {
        return this.rebuild("full");
      } else if (incremental > 0) {
        return this.rebuild("incremental");
      }
    });

    this.documentObserver.observe(this.targetDocument.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });
  }
}

/**
 * Create a Tailwind processor for a specific document
 * @param targetDocument - The document to process (defaults to current document)
 * @returns TailwindProcessor instance
 */
export function createTailwindProcessor(
  targetDocument: Document = document
): TailwindProcessor {
  return new TailwindProcessor(targetDocument);
}

/**
 * Initialize Tailwind CSS for a specific document
 * @param targetDocument - The document to initialize Tailwind for
 * @returns Promise that resolves to the processor instance
 */
export async function initTailwind(
  targetDocument: Document = document
): Promise<TailwindProcessor> {
  const processor = new TailwindProcessor(targetDocument);
  await processor.init();
  return processor;
}

/**
 * Get all classes from a document without initializing the full processor
 * @param targetDocument - The document to scan
 * @returns Array of all unique class names found
 */
export function getAllClasses(targetDocument: Document = document): string[] {
  const allClasses = new Set<string>();

  for (let element of targetDocument.querySelectorAll("[class]")) {
    for (let c of element.classList) {
      allClasses.add(c);
    }
  }

  return Array.from(allClasses);
}
