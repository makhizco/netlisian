import * as tailwindcss from "tailwindcss";
import index from "tailwindcss/index.css";

// Standard assets setup
const assets = {
  css: {
    index,
  },
};

// Global cache definition
declare global {
  interface GlobalThis {
    __NETLISIAN_TAILWIND__?: {
      compilerPromises?: Record<string, Promise<Awaited<ReturnType<typeof tailwindcss.compile>>>>;
    };
  }
}

// --- Performance Instrumentation ---
class Instrumentation {
  start(label: string) {
    performance.mark(`${label} (start)`);
  }

  end(label: string, detail?: any) {
    performance.mark(`${label} (end)`);
    try {
      performance.measure(label, {
        start: `${label} (start)`,
        end: `${label} (end)`,
        detail,
      });
    } catch (e) {
      // Ignore measurement errors
    }
  }

  error(error: any) {
    console.error(error);
    throw error;
  }
}

const STYLE_TYPE = "text/tailwindcss";

/**
 * Tailwind processor instance for a specific document.
 * Optimized for low-overhead reuse in iframes.
 */
export class TailwindProcessor {
  private compiler: Awaited<ReturnType<typeof tailwindcss.compile>> | null = null;
  private classes = new Set<string>();
  private lastCss = "";
  private sheet: HTMLStyleElement;

  // Debouncing and Queueing
  private buildQueue = Promise.resolve();
  private nextBuildId = 1;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRebuildKind: "full" | "incremental" | null = null;

  private I = new Instrumentation();
  private styleObserver: MutationObserver;
  private documentObserver: MutationObserver | undefined;
  private targetDocument: Document;

  constructor(targetDocument: Document = document) {
    this.targetDocument = targetDocument;
    this.sheet = this.targetDocument.createElement("style");
    this.sheet.id = "generated-tailwindcss";

    // Initialize observers but don't start yet
    this.styleObserver = new MutationObserver(() => this.triggerRebuild("full"));
    this.setupDocumentObserver();
  }

  /**
   * Initialize the Tailwind processor for the target document
   */
  async init(): Promise<void> {
    await this.triggerRebuild("full");
    this.sheet.setAttribute("data-tailwind-processor", "active");

    // Only append if not already attached
    if (!this.targetDocument.getElementById("generated-tailwindcss")) {
      this.targetDocument.head.append(this.sheet);
    }
  }

  /**
   * Public accessor to get the compiled CSS string.
   * Useful for saving/publishing.
   */
  getCss(): string {
    return this.sheet.textContent || "";
  }

  /**
   * Get all classes currently detected and compiled
   */
  getAllClasses(): string[] {
    return Array.from(this.classes);
  }

  /**
   * Manually trigger a refresh (useful before publishing)
   */
  async refresh(): Promise<void> {
    await this.triggerRebuild("full");
  }

  /**
   * Clean up observers and remove style tag
   */
  destroy(): void {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.styleObserver.disconnect();
    this.documentObserver?.disconnect();
    if (this.sheet.parentNode) {
      this.sheet.parentNode.removeChild(this.sheet);
    }
  }

  // --- Internal Logic ---

  /**
   * Debounced rebuild trigger.
   * Coalesces multiple rapid DOM changes into a single build.
   */
  private async triggerRebuild(kind: "full" | "incremental"): Promise<void> {
    // Upgrade to full if requested
    if (kind === "full") {
      this.pendingRebuildKind = "full";
    } else if (this.pendingRebuildKind !== "full") {
      this.pendingRebuildKind = "incremental";
    }

    // Clear existing timer to debounce
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
    }

    return new Promise<void>((resolve) => {
      this.rebuildTimer = setTimeout(() => {
        const finalKind = this.pendingRebuildKind || "incremental";
        this.pendingRebuildKind = null;
        this.rebuildTimer = null;

        this.processBuildQueue(finalKind).then(resolve);
      }, 15); // 15ms debounce window (approx 1 frame)
    });
  }

  private async processBuildQueue(kind: "full" | "incremental"): Promise<void> {
    const run = async () => {
      // If we need an incremental build but have no compiler, force full
      if (!this.compiler && kind !== "full") {
        kind = "full";
      }

      let buildId = this.nextBuildId++;
      // this.I.start(`Build #${buildId} (${kind})`);

      if (kind === "full") {
        await this.createCompiler();
      }

      await this.buildClasses(kind);

      // this.I.end(`Build #${buildId} (${kind})`);
    };

    this.buildQueue = this.buildQueue
      .then(run)
      .catch((err) => this.I.error(err));

    return this.buildQueue;
  }

  private async createCompiler(): Promise<void> {
    this.I.start(`Create compiler`);

    // 1. Gather Styles
    const stylesheets = Array.from(
      this.targetDocument.querySelectorAll(`style[type="${STYLE_TYPE}"]`)
    ) as HTMLStyleElement[];

    let css = "";
    stylesheets.forEach((sheet) => {
      this.observeSheet(sheet);
      css += sheet.textContent + "\n";
    });

    // Ensure standard import exists
    if (!css.includes("@import")) {
      css = `@import "tailwindcss";${css}`;
    }

    // Optimization: Skip if CSS hasn't changed
    if (this.lastCss === css && this.compiler) {
      this.I.end(`Create compiler`, { cached: true });
      return;
    }
    this.lastCss = css;

    // 2. Create the Compiler
    try {
      const isStandardConfig = css.trim() === `@import "tailwindcss";`;

      if (isStandardConfig) {
        // FAST PATH: Reuse the global shared compiler instance.
        // This avoids re-parsing the heavy Tailwind config for every new iframe/document
        // that just uses the defaults.
        this.compiler = await getCompilerForBase("/");
      } else {
        // SLOW PATH: Custom CSS requires a specific compiler instance.
        // We still call getCompilerForBase first to ensure the shared internal 
        // module cache is warmed up.
        await getCompilerForBase("/");

        this.compiler = await tailwindcss.compile(css, {
          base: "/",
          loadStylesheet: this.loadStylesheet.bind(this),
          loadModule: this.loadModule.bind(this),
        });
      }
    } finally {
      this.I.end(`Create compiler`);
    }

    // Reset classes on a full rebuild so we re-validate everything
    this.classes.clear();
  }

  private async buildClasses(kind: "full" | "incremental"): Promise<void> {
    if (!this.compiler) return;

    let newClasses = new Set<string>();

    // this.I.start(`Collect classes`);

    Array.from(this.targetDocument.querySelectorAll("[class]")).forEach(
      (element) => {
        Array.from(element.classList).forEach((c) => {
          if (!c) return; // Safety check for empty strings
          if (this.classes.has(c)) return;

          this.classes.add(c);
          newClasses.add(c);
        });
      }
    );

    // this.I.end(`Collect classes`, { count: newClasses.size });

    if (newClasses.size === 0 && kind === "incremental") return;

    // this.I.start(`Generate CSS`);
    // Pass all discovered classes to build (Tailwind is smart enough to handle dupes internally)
    this.sheet.textContent = this.compiler.build(Array.from(newClasses));
    // this.I.end(`Generate CSS`);
  }

  // --- Loading Helpers ---

  private async loadStylesheet(id: string, base: string) {
    // Simple virtual router for Tailwind assets
    if (id === "tailwindcss") {
      return { path: "virtual:index.css", base, content: assets.css.index };
    }
    // Stub out other imports to prevent errors
    return { path: `virtual:${id}`, base, content: "" };
  }

  private async loadModule(): Promise<never> {
    throw new Error(`Browser build does not support plugins.`);
  }

  // --- Observers ---

  private observeSheet(sheet: HTMLStyleElement): void {
    this.styleObserver.observe(sheet, {
      characterData: true,
      subtree: true,
      childList: true,
    });
  }

  private setupDocumentObserver(): void {
    this.documentObserver = new MutationObserver((records) => {
      let full = false;
      let incremental = false;

      for (const record of records) {
        // Check added nodes
        for (const node of Array.from(record.addedNodes)) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;

          // If a style tag changed, we need a full rebuild
          if (el.tagName === "STYLE" && el.getAttribute("type") === STYLE_TYPE) {
            this.observeSheet(el as HTMLStyleElement);
            full = true;
            break; // Full rebuild takes precedence
          }

          // If normal elements added, checks for classes
          if (el.tagName !== "STYLE") {
            incremental = true;
          }
        }
        if (full) break;

        // Check attribute changes (class updates)
        if (record.type === "attributes") {
          incremental = true;
        }
      }

      if (full) {
        this.triggerRebuild("full");
      } else if (incremental) {
        this.triggerRebuild("incremental");
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

// --- Public API Exports ---

export function createTailwindProcessor(targetDocument: Document = document): TailwindProcessor {
  return new TailwindProcessor(targetDocument);
}

export async function initTailwind(targetDocument: Document = document): Promise<TailwindProcessor> {
  const processor = new TailwindProcessor(targetDocument);
  await processor.init();
  return processor;
}

/**
 * Generate CSS for a list of classes manually.
 * Uses the cached global compiler for max speed.
 */
export async function generateCssFromClasses(
  input: string | string[],
  base: string = "/"
): Promise<string> {
  const classes = new Set<string>();

  const list = typeof input === "string" ? [input] : input;
  for (const item of list) {
    if (!item) continue;
    for (const c of item.split(/\s+/)) {
      if (c) classes.add(c);
    }
  }

  const compiler = await getCompilerForBase(base);
  return compiler.build(Array.from(classes));
}

/**
 * GLOBAL COMPILER CACHE
 * Stores the Promise of the initialized compiler.
 * This prevents re-parsing standard Tailwind config on every reload/iframe.
 */
export async function getCompilerForBase(base: string = "/") {
  if (!(globalThis as any).__NETLISIAN_TAILWIND__) {
    (globalThis as any).__NETLISIAN_TAILWIND__ = { compilerPromises: {} };
  }

  const store = (globalThis as any).__NETLISIAN_TAILWIND__;
  if (!store.compilerPromises) store.compilerPromises = {};

  // If cache exists, return it
  if (store.compilerPromises[base]) {
    return store.compilerPromises[base];
  }

  // Initialize and Cache
  store.compilerPromises[base] = (async () => {
    const css = `@import "tailwindcss";`;

    // This is the "heavy" call (~200ms execution time usually)
    // We do it once per window session per base path.
    const compiler = await tailwindcss.compile(css, {
      base,
      loadStylesheet: async (id: string, basePath: string) => {
        if (id === "tailwindcss") {
          return {
            path: "virtual:tailwindcss/index.css",
            base: basePath,
            content: assets.css.index,
          };
        }
        // Stub sub-imports to avoid crashes
        return { path: `virtual:${id}`, base: basePath, content: "" };
      },
      loadModule: async () => {
        throw new Error(`Browser build does not support plugins.`);
      },
    });

    return compiler;
  })();

  return store.compilerPromises[base];
}

export function clearTailwindCompilerCache(base?: string) {
  const store = (globalThis as any).__NETLISIAN_TAILWIND__;
  if (!store || !store.compilerPromises) return;

  if (base) {
    delete store.compilerPromises[base];
  } else {
    store.compilerPromises = {};
  }
}