import React from "react";
import {
  type ArrayField,
  type ComponentConfig,
  type ComponentData,
  type Content,
  type PuckComponent,
  type SlotComponent,
  createUsePuck,
} from "@puckeditor/core";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  useNodesState,
  useEdgesState,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Represents a single page configuration item within the multipage array.
 */
export interface PageItem {
  /** Unique page identifier, typically a URL-safe slug */
  id: string;
  /** Title of the page displayed in node headers and lists */
  title: string;
  /** Optional description metadata for the page */
  description?: string;
}

/**
 * Props for the MultipageRoot component.
 */
export interface MultipageRootProps {
  /** Key name of the array field storing pages in Puck state */
  collectionName?: string;
  /** Key name of the slot component field inside each page item */
  pageName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Hooks & Core Context
// ---------------------------------------------------------------------------

const usePuck = createUsePuck();

/**
 * Custom hook to control pan behaviors inside the React Flow viewport canvas.
 */
export function usePreventPanOnDrag() {
  const isDragging = usePuck((s) => s.appState.ui.isDragging);
  return !isDragging;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { PageNode } from "./PageNode";

const nodeTypes = {
  pageNode: PageNode,
};

// ---------------------------------------------------------------------------
// Page Mutation Watcher (Handles atomic Deletions & Reordering)
// ---------------------------------------------------------------------------

/**
 * Watcher component that monitors updates to the pages array.
 * If pages are reordered or deleted, it re-maps the Puck zone paths to preserve slot content mapping.
 */
const PageMutationWatcher = ({
  pages,
  collectionName = "collection",
  pageName = "page",
}: {
  pages: PageItem[];
  collectionName?: string;
  pageName?: string;
}) => {
  const dispatch = usePuck((s) => s.dispatch);
  const prevPagesRef = React.useRef<PageItem[]>(pages);

  React.useEffect(() => {
    const prevPages = prevPagesRef.current;
    const currPages = pages;

    const currIndicesUsed = new Set<number>();
    const deletedPages: { id: string; oldIndex: number }[] = [];
    const movedPages: { id: string; oldIndex: number; newIndex: number }[] = [];

    currPages.forEach((p, newIndex) => {
      const oldIndex = prevPages.findIndex(
        (prev, i) => prev.id === p.id && !currIndicesUsed.has(i),
      );
      if (oldIndex !== -1) {
        currIndicesUsed.add(oldIndex);
        if (oldIndex !== newIndex) {
          movedPages.push({ id: p.id, oldIndex, newIndex });
        }
      }
    });

    prevPages.forEach((p, i) => {
      if (!currIndicesUsed.has(i)) {
        deletedPages.push({ id: p.id, oldIndex: i });
      }
    });

    if (deletedPages.length === 0 && movedPages.length === 0) {
      prevPagesRef.current = currPages;
      return;
    }

    dispatch({
      type: "setData",
      data: (previous) => {
        const newZones = { ...previous.zones };
        // Map: oldIndex → extracted zone content (both plain and root-prefixed variants)
        const extracted: Record<number, { plain: Content; root: Content }> = {};

        // --- Deletions ---
        // Recursively collect all component IDs in the deleted page's zone
        // so we can scrub their nested zones too (avoiding orphaned zone entries).
        deletedPages.forEach(({ oldIndex }) => {
          const plainKey = `${collectionName}[${oldIndex}].${pageName}`;
          const rootKey = `root:${plainKey}`;

          const topLevel = [
            ...(previous.zones?.[plainKey] || []),
            ...(previous.zones?.[rootKey] || []),
          ];
          const idsToClean = new Set<string>();
          const pending = topLevel
            .map((c: ComponentData) => c.props.id)
            .filter((id): id is string => typeof id === "string");

          while (pending.length > 0) {
            const id = pending.shift()!;
            if (idsToClean.has(id)) continue;
            idsToClean.add(id);
            Object.entries(previous.zones || {}).forEach(([zoneId, items]) => {
              if (zoneId.startsWith(`${id}:`)) {
                (items as Content).forEach((item: ComponentData) => {
                  if (item.props.id) pending.push(item.props.id as string);
                });
              }
            });
          }

          // Remove the page's own slot zones
          delete newZones[plainKey];
          delete newZones[rootKey];

          // Remove all nested component zones that belonged to this page
          idsToClean.forEach((id) => {
            Object.keys(newZones).forEach((zoneId) => {
              if (zoneId.startsWith(`${id}:`)) delete newZones[zoneId];
            });
          });
        });

        // --- Extract moved pages (read ALL before writing to avoid index collisions) ---
        movedPages.forEach(({ oldIndex }) => {
          const plainKey = `${collectionName}[${oldIndex}].${pageName}`;
          const rootKey = `root:${plainKey}`;
          extracted[oldIndex] = {
            plain: previous.zones?.[plainKey] || [],
            root: previous.zones?.[rootKey] || [],
          };
          // Remove the old keys from the new zones map
          delete newZones[plainKey];
          delete newZones[rootKey];
        });

        // --- Write moved pages to their new positions ---
        movedPages.forEach(({ oldIndex, newIndex }) => {
          const newPlainKey = `${collectionName}[${newIndex}].${pageName}`;
          const newRootKey = `root:${newPlainKey}`;
          const content = extracted[oldIndex];
          if (content.plain.length > 0) newZones[newPlainKey] = content.plain;
          if (content.root.length > 0) newZones[newRootKey] = content.root;
        });

        return { ...previous, zones: newZones };
      },
    });

    prevPagesRef.current = currPages;
  }, [pages, dispatch]);

  return null;
};

// ---------------------------------------------------------------------------
// MultipageRoot component
// ---------------------------------------------------------------------------

/**
 * MultipageRoot component renders the infinite canvas node builder workspace.
 * Each item in the collection array is displayed as a node containing a dropzone slot editor.
 */
export const MultipageRoot: PuckComponent<MultipageRootProps> = ({
  collectionName = "collection",
  pageName = "page",
  ...props
}) => {
  const pages = (props[collectionName] as PageItem[]) || [];
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [, , onEdgesChange] = useEdgesState([]);
  const pagesKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    // Only re-sync nodes when page identity/metadata changes (id or title).
    // Serializing the full pages array includes slot function references which
    // change on every Puck render, causing unnecessary setNodes calls.
    const key = JSON.stringify(pages.map(({ id, title }) => ({ id, title })));
    if (key === pagesKeyRef.current) return;
    pagesKeyRef.current = key;

    const cols = 3;
    const seen = new Set<string>();
    const validPages =
      pages?.filter((p) => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      }) || [];

    setNodes((prevNodes) =>
      validPages.map((page, i) => {
        const slot = (page as PageItem & Record<string, SlotComponent>)[
          pageName
        ];
        const position = {
          x: (i % cols) * 900,
          y: Math.floor(i / cols) * 1200,
        };

        const existingNode = prevNodes.find((n) => n.id === page.id);

        // Reconcile: If the node exists and its rendered data hasn't fundamentally changed,
        // reuse the exact same node object reference. This allows React Flow to bail out
        // of re-rendering this specific PageNode, even though the collection changed.
        if (
          existingNode &&
          existingNode.data.page.title === page.title &&
          existingNode.data.index === i &&
          existingNode.position.x === position.x &&
          existingNode.position.y === position.y
        ) {
          return existingNode;
        }

        return {
          id: page.id,
          position,
          // Slot is seeded here once on structural change. Puck's slot
          // component reads from the Puck store internally and keeps rendering
          // updated content without needing React Flow to push new data.
          data: { page, index: i, slot },
          type: "pageNode",
          selectable: false,
          draggable: false,
        };
      }),
    );
  }, [pages, pageName]);

  // Slot functions are seeded into node data once when setNodes runs
  // (on collection structure changes only). Puck's slot component subscribes
  // to the Puck store internally, so it re-renders itself when content
  // changes — no React Flow involvement needed.

  return (
    <div
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

      <PageMutationWatcher
        pages={pages as unknown as PageItem[]}
        collectionName={collectionName}
        pageName={pageName}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Puck config
// ---------------------------------------------------------------------------

export interface MultipageRootOptions {
  /** The state property key for the pages collection array */
  collectionName?: string;
  /** The slot property key inside each page item */
  pageName?: string;
}

/**
 * Dynamic config generator for Puck to register the multipage builder canvas root component.
 */
export const createMultipageRootConfig = ({
  collectionName = "collection",
  pageName = "page",
}: MultipageRootOptions = {}): ComponentConfig<MultipageRootProps> => {
  type ExtendedPageItem = PageItem & Record<string, unknown>;

  return {
    defaultProps: {
      [collectionName]: [],
    },
    fields: {
      [collectionName]: {
        type: "array",
        label: "Collection",
        defaultItemProps: {
          id: "new-page",
          title: "New Page",
          description: "",
        },
        arrayFields: {
          title: { type: "text", label: "Title" },
          id: {
            type: "text",
            label: "ID",
          },
          [pageName]: {
            type: "slot",
            label: "Slot",
          },
        },
        getItemSummary: (item: PageItem) => item.title || item.id || "New Page",
      } as ArrayField<ExtendedPageItem[]>,
    },
    render: (props) => (
      <MultipageRoot
        {...props}
        collectionName={collectionName}
        pageName={pageName}
      />
    ),
  };
};
