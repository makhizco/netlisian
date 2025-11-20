import * as tailwindcss from "tailwindcss";
import index from "tailwindcss/index.css";
import theme from "tailwindcss/theme.css";
import utilities from "tailwindcss/utilities.css";

const assets = {
  css: {
    index,
    theme,
    utilities,
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

    console.error(error);
  }
}

/**
 * The type used by `<style>` tags that contain input CSS.
 */
const STYLE_TYPE = "text/tailwindcss";

export class TailwindProcessor {
  /**
   * The current Tailwind CSS compiler.
   *
   * This gets recreated:
   * - When stylesheets change
   */
  private compiler: Awaited<ReturnType<typeof tailwindcss.compile>> | undefined;

  /**
   * The list of all seen classes on the page so far. The compiler already has a
   * cache of classes but this lets us only pass new classes to `build(…)`.
   */
  private classes = new Set<string>();

  /**
   * The last input CSS that was compiled. If stylesheets "change" without
   * actually changing, we can avoid a full rebuild.
   */
  private lastCss = "";

  /**
   * The stylesheet that we use to inject the compiled CSS into the page.
   */
  private sheet: HTMLStyleElement;

  /**
   * The queue of build tasks that need to be run. This is used to ensure that we
   * don't run multiple builds concurrently.
   */
  private buildQueue = Promise.resolve();

  /**
   * What build this is
   */
  private nextBuildId = 1;

  /**
   * Used for instrumenting the build process. This data shows up in the
   * performance tab of the browser's devtools.
   */
  private I = new Instrumentation();

  private styleObserver: MutationObserver;
  private documentObserver: MutationObserver | undefined;
  private targetDocument: Document;

  constructor(targetDocument: Document = document) {
    this.targetDocument = targetDocument;
    this.sheet = this.targetDocument.createElement("style");
    this.sheet.id = "generated-tailwindcss";

    this.styleObserver = new MutationObserver(() => this.rebuild("full"));
    this.setupDocumentObserver();
  }

  async init(): Promise<void> {
    await this.rebuild("full");
    this.sheet.setAttribute("data-tailwind-processor", "active");
    if (!this.targetDocument.head.contains(this.sheet)) {
      this.targetDocument.head.append(this.sheet);
    }
  }

  /**
   * Returns the compiled CSS string from the style sheet.
   */
  getCss(): string {
    return this.sheet.textContent || "";
  }

  /**
   * Returns the list of all unique class names currently being tracked.
   */
  getAllClasses(): string[] {
    return Array.from(this.classes);
  }

  /**
   * Manually generate classes from a string or array of strings.
   * Useful for classes not present in the DOM (e.g. CVA variants).
   */
  async generate(input: string | string[]): Promise<void> {
    const list = typeof input === "string" ? [input] : input;
    let hasNew = false;

    for (const item of list) {
      const parts = item.split(/\s+/);
      for (const c of parts) {
        if (c && !this.classes.has(c)) {
          this.classes.add(c);
          hasNew = true;
        }
      }
    }

    if (hasNew) {
      await this.rebuild("incremental");
    }
  }

  destroy(): void {
    this.styleObserver.disconnect();
    this.documentObserver?.disconnect();
    if (this.sheet.parentNode) {
      this.sheet.parentNode.removeChild(this.sheet);
    }
  }

  /**
   * Create the Tailwind CSS compiler
   *
   * This handles loading imports, plugins, configs, etc…
   *
   * This does **not** imply that the CSS is actually built. That happens in the
   * `build` function and is a separate scheduled task.
   */
  private async createCompiler(): Promise<void> {
    this.I.start(`Create compiler`);
    this.I.start("Reading Stylesheets");

    // The stylesheets may have changed causing a full rebuild so we'll need to
    // gather the latest list of stylesheets.
    const stylesheets = Array.from(
      this.targetDocument.querySelectorAll(`style[type="${STYLE_TYPE}"]`)
    ) as HTMLStyleElement[];

    let css = "";
    for (let sheet of stylesheets) {
      this.observeSheet(sheet);
      css += sheet.textContent + "\n";
    }

    // The user might have no stylesheets, or a some stylesheets without `@import`
    // because they want to customize their theme so we'll inject the main import
    // for them. However, if they start using `@import` we'll let them control
    // the build completely.
    if (!css.includes("@import")) {
      css = `@import "theme"; @import "utilities"; ${css}`;
    }

    this.I.end("Reading Stylesheets", {
      size: css.length,
      changed: this.lastCss !== css,
    });

    // The input CSS did not change so the compiler does not need to be recreated
    if (this.lastCss === css && this.compiler) return;

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

    // We do not clear classes here to preserve manually generated classes
  }

  private async loadStylesheet(id: string, base: string) {
    if (id === "theme") {
      return { path: "virtual:theme", base, content: assets.css.theme };
    }
    if (id === "utilities") {
      return { path: "virtual:utilities", base, content: assets.css.utilities };
    }

    if (id === "tailwindcss") {
      return {
        path: "virtual:tailwindcss/index.css",
        base,
        content: assets.css.index,
      };
    } else if (
      id === "tailwindcss/theme" ||
      id === "tailwindcss/theme.css" ||
      id === "./theme.css"
    ) {
      return {
        path: "virtual:tailwindcss/theme.css",
        base,
        content: assets.css.theme,
      };
    } else if (
      id === "tailwindcss/utilities" ||
      id === "tailwindcss/utilities.css" ||
      id === "./utilities.css"
    ) {
      return {
        path: "virtual:tailwindcss/utilities.css",
        base,
        content: assets.css.utilities,
      };
    } else if (
      id === "tailwindcss/preflight" ||
      id === "tailwindcss/preflight.css" ||
      id === "./preflight.css"
    ) {
      return {
        path: "virtual:tailwindcss/preflight.css",
        base,
        content: "", // Preflight intentionally empty
      };
    }

    throw new Error(`The browser build does not support @import for "${id}"`);
  }

  private async loadModule(): Promise<never> {
    throw new Error(
      `The browser build does not support plugins or config files.`
    );
  }

  private async build(kind: "full" | "incremental") {
    if (!this.compiler) return;

    // 1. Refresh the known list of classes
    let newClasses = new Set<string>();

    this.I.start(`Collect classes`);

    for (let element of Array.from(
      this.targetDocument.querySelectorAll("[class]")
    )) {
      for (let c of Array.from(element.classList)) {
        if (this.classes.has(c)) continue;

        this.classes.add(c);
        newClasses.add(c);
      }
    }

    this.I.end(`Collect classes`, {
      count: newClasses.size,
    });

    // 2. Compile the CSS
    this.I.start(`Build utilities`);

    this.sheet.textContent = this.compiler.build(Array.from(this.classes));

    this.I.end(`Build utilities`);
  }

  private rebuild(kind: "full" | "incremental") {
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

  private observeSheet(sheet: HTMLStyleElement) {
    this.styleObserver.observe(sheet, {
      attributes: true,
      attributeFilter: ["type"],
      characterData: true,
      subtree: true,
      childList: true,
    });
  }

  private setupDocumentObserver() {
    this.documentObserver = new MutationObserver((records) => {
      let full = 0;
      let incremental = 0;

      for (let record of records) {
        // New stylesheets == tracking + full rebuild
        for (let node of Array.from(record.addedNodes)) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as HTMLElement;

          if (
            el.tagName === "STYLE" &&
            el.getAttribute("type") === STYLE_TYPE
          ) {
            this.observeSheet(el as HTMLStyleElement);
            full++;
          } else if (el.tagName !== "STYLE" && el !== this.sheet) {
            // New elements
            incremental++;
          }
        }

        // Changes to class attributes require an incremental rebuild
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

export function createTailwindProcessor(
  targetDocument: Document = document
): TailwindProcessor {
  return new TailwindProcessor(targetDocument);
}

export async function initTailwind(
  targetDocument: Document = document
): Promise<TailwindProcessor> {
  const processor = new TailwindProcessor(targetDocument);
  await processor.init();
  return processor;
}