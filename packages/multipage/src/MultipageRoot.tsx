import React from "react";
import { createUsePuck } from "@puckeditor/core";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  useNodesState,
  useEdgesState,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageItem {
  id: string;
  title: string;
  description?: string;
}

export interface MultipageRootProps {
  /** Key name of the array field storing pages in Puck state */
  collectionName?: string;
  /** Key name of the slot component field inside each page item */
  pageName?: string;
  [key: string]: unknown;
}

export interface MultipageRootOptions {
  /** The state property key for the pages collection array. Defaults to "pages". */
  collectionName?: string;
  /** The slot property key inside each page item. Defaults to "slot". */
  pageName?: string;
  /**
   * Extra Puck field definitions spread at the ROOT level alongside the
   * collection field (e.g. a global site title, theme tokens).
   */
  rootFields?: Record<string, any>;
  /** Default values for the extra root-level fields above. */
  rootDefaultProps?: Record<string, unknown>;
  /**
   * Additional Puck field definitions spread into the collection's `arrayFields`
   * alongside `id`, `title`, and the slot field.
   *
   * Global schema: the same field shape applies to ALL pages.
   * Each page has its own edited values; there is no per-page field config.
   *
   * Example: `status`, `seoTitle`, `locale`.
   */
  pageFields?: Record<string, any>;
  /** Default values for `pageFields` injected into `defaultItemProps`. */
  pageDefaults?: Record<string, unknown>;
  /**
   * Custom summary string shown in the Puck array field item row.
   * Typed — no `any`. Defaults to `item.title || item.id || "New Page"`.
   */
  getPageSummary?: (item: PageItem & Record<string, unknown>) => string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const usePuck = createUsePuck();

export function usePreventPanOnDrag() {
  const isDragging = usePuck((s) => s.appState.ui.isDragging);
  return !isDragging;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert any string to a URL-safe slug */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generates a stable default page id: slug + short timestamp suffix */
function generateId(title = "new-page"): string {
  const base = toSlug(title) || "page";
  return `${base}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Custom field: SlugIdField
// Reads the `title` sibling field and auto-derives the slug.
// The user can still override it manually.
// ---------------------------------------------------------------------------

interface SlugIdFieldProps {
  value: string;
  onChange: (value: string) => void;
  // Puck passes the full item object through `otherProps` for array fields
  // but the stable API uses a `field` object; we access siblings via `readOnly`
  // context. Instead we store derivation state locally.
}

const SlugIdField = ({ value, onChange }: SlugIdFieldProps) => {
  const [localValue, setLocalValue] = React.useState(value ?? "");
  const [isManual, setIsManual] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value on first mount / external changes
  React.useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const commit = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(next);
    }, 400);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManual(true);
    const slug = toSlug(e.target.value);
    setLocalValue(slug);
    commit(slug);
  };

  const handleReset = () => {
    setIsManual(false);
    // Caller should regenerate; we just clear so the title can re-derive
    const next = generateId();
    setLocalValue(next);
    onChange(next);
  };

  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder="auto-generated from title"
        style={{
          flex: 1,
          padding: "4px 8px",
          border: "1px solid var(--puck-color-grey-08)",
          borderRadius: "4px",
          fontSize: "13px",
          fontFamily: "monospace",
          background: isManual
            ? "var(--puck-color-white)"
            : "var(--puck-color-grey-11)",
          color: "var(--puck-color-grey-03)",
          outline: "none",
        }}
      />
      <button
        type="button"
        onClick={handleReset}
        title="Regenerate ID"
        style={{
          padding: "4px 8px",
          border: "1px solid var(--puck-color-grey-08)",
          borderRadius: "4px",
          background: "var(--puck-color-white)",
          cursor: "pointer",
          fontSize: "12px",
          color: "var(--puck-color-grey-05)",
          flexShrink: 0,
        }}
      >
        ↺
      </button>
    </div>
  );
};

import { PageNode } from "./PageNode";

// Defined at module scope so the reference is always stable (React Flow warning)
const nodeTypes = {
  pageNode: PageNode,
};

// ---------------------------------------------------------------------------
// Page Deletion Watcher
// ---------------------------------------------------------------------------

const PageDeletionWatcher = ({ pages }: { pages: PageItem[] }) => {
  const dispatch = usePuck((s) => s.dispatch);
  const zones = usePuck((s) => s.appState.data.zones || {});

  const prevPagesRef = React.useRef<PageItem[]>(pages);

  React.useEffect(() => {
    // Only proceed if the number of pages decreased
    if (pages.length < prevPagesRef.current.length) {
      const currentIds = new Set(pages.map((p) => p.id));
      const removedIds = prevPagesRef.current
        .map((p) => p.id)
        .filter((id) => !currentIds.has(id));

      removedIds.forEach((id) => {
        const zoneKey = `root:${id}`;
        const items = zones[zoneKey];
        if (items && items.length > 0) {
          // Remove items from the end to the beginning to avoid index shifting issues
          for (let i = items.length - 1; i >= 0; i--) {
            dispatch({ type: "remove", index: i, zone: zoneKey });
          }
        }
      });
    }
    prevPagesRef.current = pages;
  }, [pages, zones, dispatch]);

  return null;
};

// ---------------------------------------------------------------------------
// MultipageRoot component
// ---------------------------------------------------------------------------

export const MultipageRoot = (props: MultipageRootProps) => {
  const collectionName = props.collectionName ?? "pages";
  const pageName = props.pageName ?? "slot";
  const pages = (props[collectionName] as PageItem[]) || [];
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [, , onEdgesChange] = useEdgesState([]);
  const canPan = usePreventPanOnDrag();

  // Puck passes a NEW `pages` array reference on every render even when the
  // content is identical. We fingerprint with JSON to only call setNodes when
  // data actually changes, preventing the infinite-update loop.
  const pagesKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    const key = JSON.stringify(pages);
    if (key === pagesKeyRef.current) return;
    pagesKeyRef.current = key;

    const cols = 3;

    // Filter out pages with empty/duplicate IDs — those would cause React key
    // warnings inside ReactFlow's NodeRenderer and MiniMap.
    const seen = new Set<string>();
    const validPages = pages.filter((p) => {
      if (!p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    setNodes(
      validPages.map((page, i) => ({
        id: page.id,
        position: { x: (i % cols) * 900, y: Math.floor(i / cols) * 1200 },
        data: { page },
        type: "pageNode",
      })),
    );
  }); // no dep array — runs every render, exits early via ref guard above

  return (
    <div
      data-puck-preview
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        backgroundColor: "var(--puck-color-grey-11)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        panOnScroll={true}
        selectionOnDrag={true}
        panOnDrag={false}
        nodesDraggable={false}
        fitView
        minZoom={0.1}
      >
        <Background color="var(--puck-color-grey-08)" gap={16} />
        <Controls />
        <MiniMap zoomable pannable />
      </ReactFlow>

      {nodes.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: "40px 60px",
              backgroundColor:
                "color-mix(in srgb, var(--puck-color-white) 90%, transparent)",
              border: "2px dashed var(--puck-color-grey-08)",
              borderRadius: "12px",
              textAlign: "center",
              backdropFilter: "blur(4px)",
              pointerEvents: "auto",
            }}
          >
            <h3
              style={{
                margin: "0 0 8px 0",
                color: "var(--puck-color-grey-02)",
                fontSize: "18px",
              }}
            >
              Your workspace is empty
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--puck-color-grey-05)",
                fontSize: "14px",
              }}
            >
              Add a page from the left sidebar to get started.
            </p>
          </div>
        </div>
      )}

      {/* Hidden render slot keeps Puck happy about the root `children` prop */}
      <div style={{ display: "none" }}>
        {props[pageName] as React.ReactNode}
      </div>
      <PageDeletionWatcher pages={pages} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Puck config factory
// ---------------------------------------------------------------------------

export const createMultipageRootConfig = ({
  collectionName = "pages",
  pageName = "slot",
  rootFields = {},
  rootDefaultProps = {},
  pageFields = {},
  pageDefaults = {},
  getPageSummary = (item: PageItem & Record<string, unknown>) =>
    (item.title as string) || item.id || "New Page",
}: MultipageRootOptions = {}) => ({
  defaultProps: {
    ...rootDefaultProps,
    [collectionName]: [] as PageItem[],
  },
  fields: {
    ...rootFields,
    [collectionName]: {
      label: "Pages",
      type: "array" as const,
      defaultItemProps: {
        id: "new-page",
        title: "New Page",
        description: "",
        ...pageDefaults,
      },
      arrayFields: {
        title: { type: "text" as const },
        id: {
          type: "custom" as const,
          render: ({
            value,
            onChange,
          }: {
            value: string;
            onChange: (v: string) => void;
          }) => <SlugIdField value={value} onChange={onChange} />,
        },
        description: { type: "text" as const },
        ...pageFields,
        // Slot must always be last so it renders at the bottom of the sidebar
        [pageName]: {
          type: "slot" as const,
          label: "Slot",
        },
      },
      getItemSummary: getPageSummary,
    },
  },
  render: (renderProps: MultipageRootProps) => (
    <MultipageRoot
      {...renderProps}
      collectionName={collectionName}
      pageName={pageName}
    />
  ),
});

/** @deprecated Use `createMultipageRootConfig()` instead. */
export const multipageRootConfig = createMultipageRootConfig();
