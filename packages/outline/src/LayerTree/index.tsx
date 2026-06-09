import styles from "./styles.module.css";
import getClassNameFactory from "../get-class-name-factory";
import { ChevronDown, LayoutGrid, Layers, Type } from "lucide-react";
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useRef,
} from "react";
import { createUsePuck } from "@measured/puck";
import { useVirtualizer } from "@tanstack/react-virtual";

const usePuck = createUsePuck();

const getClassName = getClassNameFactory("LayerTree", styles);
const getClassNameLayer = getClassNameFactory("Layer", styles);

const DEFAULT_LAYER_ROW_HEIGHT = 32;
const LAYER_TREE_VIRTUALIZATION_OVERSCAN = 8;
const MIN_VIRTUALIZED_LAYER_COUNT = 25;
const measuredRowHeights = new Map<string, number>();

export type LayerZoneTree = {
  items: LayerNodeTree[];
  label?: string;
  zoneCompound: string;
};

type LayerNodeTree = {
  childZones: LayerZoneTree[];
  componentType: string;
  index: number;
  itemId: string;
  label: string;
  zoneCompound: string;
};

const getZonesByParent = (zones: any) => {
  return Object.keys(zones).reduce<Record<string, string[]>>((acc, zone) => {
    const [parentId] = zone.split(":");
    acc[parentId] = [...(acc[parentId] || []), zone];
    return acc;
  }, {});
};

const getZoneLabel = (
  zoneCompound: string,
  nodes: any,
  config: any,
  label?: string
) => {
  if (label !== undefined) {
    return label;
  }

  const [componentId, slotId] = zoneCompound.split(":");
  if (!slotId) return;

  const componentType = nodes[componentId]?.data.type;
  const configForComponent =
    componentType && componentType !== "root"
      ? config.components[componentType]
      : config.root;

  return configForComponent?.fields?.[slotId]?.label ?? slotId;
};

const buildLayerNode = ({
  config,
  itemId,
  index,
  nodes,
  zoneCompound,
  zones,
  zonesByParent,
}: any): LayerNodeTree => {
  const nodeData = nodes[itemId];
  const componentType = nodeData?.data.type?.toString() || "Component";
  const label = config.components[componentType]?.label ?? componentType;
  const childZoneCompounds = zonesByParent[itemId] || [];

  return {
    childZones: childZoneCompounds.map((childZoneCompound: string) =>
      buildLayerTree({
        config,
        nodes,
        zoneCompound: childZoneCompound,
        zones,
        zonesByParent,
      })
    ),
    componentType,
    index,
    itemId,
    label,
    zoneCompound,
  };
};

export const buildLayerTree = ({
  config,
  label,
  nodes,
  zoneCompound,
  zones,
  zonesByParent = getZonesByParent(zones),
}: any): LayerZoneTree => {
  const contentIds = zones[zoneCompound]?.contentIds ?? [];

  return {
    items: contentIds.map((itemId: string, index: number) =>
      buildLayerNode({
        config,
        itemId,
        index,
        nodes,
        zoneCompound,
        zones,
        zonesByParent,
      })
    ),
    label: getZoneLabel(zoneCompound, nodes, config, label),
    zoneCompound,
  };
};

const getEstimatedRowHeight = (itemId: string) =>
  measuredRowHeights.get(itemId) ?? DEFAULT_LAYER_ROW_HEIGHT;

const cacheMeasuredRowHeight = (itemId: string, height: number) => {
  if (height <= 0) return;
  measuredRowHeights.set(itemId, height);
};

const getScrollParent = (el: HTMLElement | null) => {
  let current = el?.parentElement ?? null;
  while (current) {
    const { overflow, overflowY } = getComputedStyle(current);
    if ([overflow, overflowY].some((value) => /auto|scroll/.test(value))) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const Layer = forwardRef(function Layer(
  {
    childIsSelected,
    dataIndex,
    depth,
    isSelected,
    node,
    selectedId,
    selectedPathIds,
  }: any,
  ref: ForwardedRef<HTMLLIElement>
) {
  const dispatch = usePuck((s: any) => s.dispatch);
  const isHovering = false; // Replaced context store logic with false for standalone
  const containsZone = node.childZones.length > 0;

  const setItemSelector = useCallback(
    (itemSelector: any | null) => {
      dispatch({ type: "setUi", ui: { itemSelector } });
    },
    [dispatch]
  );

  const shouldRenderChildren = isSelected || childIsSelected;

  return (
    <li
      ref={ref}
      className={getClassNameLayer({
        childIsSelected,
        containsZone,
        isHovering,
        isSelected,
      })}
      data-index={dataIndex}
      data-puck-layer-tree-id={node.itemId}
    >
      <div className={getClassNameLayer("inner")}>
        <button
          type="button"
          className={getClassNameLayer("clickable")}
          onClick={() => {
            if (isSelected) {
              setItemSelector(null);
              return;
            }
            setItemSelector({ index: node.index, zone: node.zoneCompound });
            // Mocking scroll logic
            document.querySelector(`[data-puck-node-id="${node.itemId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          {containsZone && (
            <div className={getClassNameLayer("chevron")} title={isSelected ? "Collapse" : "Expand"}>
              <ChevronDown size="12" />
            </div>
          )}
          <div className={getClassNameLayer("title")}>
            <div className={getClassNameLayer("icon")}>
              {node.componentType === "Text" || node.componentType === "Heading" ? (
                <Type size="16" />
              ) : (
                <LayoutGrid size="16" />
              )}
            </div>
            <div className={getClassNameLayer("name")}>{node.label}</div>
          </div>
        </button>
      </div>
      {containsZone &&
        shouldRenderChildren &&
        node.childZones.map((childZone: any) => (
          <div key={childZone.zoneCompound} className={getClassNameLayer("zones")}>
            <LayerTreeZone
              depth={depth + 1}
              selectedId={selectedId}
              selectedPathIds={selectedPathIds}
              tree={childZone}
            />
          </div>
        ))}
    </li>
  );
});

const LayerTreeZone = ({ depth, selectedId, selectedPathIds, tree }: any) => {
  const shouldVirtualize = depth === 0 && tree.items.length >= MIN_VIRTUALIZED_LAYER_COUNT;
  return (
    <>
      {tree.label && (
        <div className={getClassName("zoneTitle")}>
          <div className={getClassName("zoneIcon")}><Layers size="16" /></div>
          {tree.label}
        </div>
      )}
      {shouldVirtualize ? (
        <VirtualizedLayerTreeItems depth={depth} selectedId={selectedId} selectedPathIds={selectedPathIds} tree={tree} />
      ) : (
        <StaticLayerTreeItems depth={depth} selectedId={selectedId} selectedPathIds={selectedPathIds} tree={tree} />
      )}
    </>
  );
};

const StaticLayerTreeItems = ({ depth, selectedId, selectedPathIds, tree }: any) => {
  return (
    <ul className={getClassName()}>
      {tree.items.length === 0 && <div className={getClassName("helper")}>No items</div>}
      {tree.items.map((node: any) => (
        <Layer
          childIsSelected={selectedPathIds.has(node.itemId)}
          depth={depth}
          isSelected={selectedId === node.itemId}
          key={node.itemId}
          node={node}
          selectedId={selectedId}
          selectedPathIds={selectedPathIds}
        />
      ))}
    </ul>
  );
};

const VirtualizedLayerTreeItems = ({ depth, selectedId, selectedPathIds, tree }: any) => {
  const listRef = useRef<HTMLUListElement | null>(null);
  const virtualizer = useVirtualizer({
    count: tree.items.length,
    estimateSize: (index) => getEstimatedRowHeight(tree.items[index].itemId),
    getItemKey: (index) => tree.items[index].itemId,
    getScrollElement: () => getScrollParent(listRef.current),
    overscan: LAYER_TREE_VIRTUALIZATION_OVERSCAN,
    measureElement: (element: HTMLElement) => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      const itemId = element.dataset.puckLayerTreeId;
      if (itemId) cacheMeasuredRowHeight(itemId, height);
      return height || DEFAULT_LAYER_ROW_HEIGHT;
    },
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const renderedItems = [];
  let previousEnd = 0;
  let previousIndex = -1;

  virtualItems.forEach((virtualItem) => {
    const node = tree.items[virtualItem.index];
    const gapSize = Math.max(virtualItem.start - previousEnd, 0);

    if (gapSize > 0) {
      renderedItems.push(<li key={`gap:${tree.zoneCompound}:${previousIndex}:${virtualItem.index}`} aria-hidden="true" style={{ height: `${gapSize}px` }} />);
    }

    renderedItems.push(
      <Layer
        childIsSelected={selectedPathIds.has(node.itemId)}
        dataIndex={virtualItem.index}
        depth={depth}
        isSelected={selectedId === node.itemId}
        key={node.itemId}
        node={node}
        ref={virtualizer.measureElement}
        selectedId={selectedId}
        selectedPathIds={selectedPathIds}
      />
    );

    previousEnd = virtualItem.end;
    previousIndex = virtualItem.index;
  });

  const trailingGap = Math.max(totalSize - previousEnd, 0);
  if (trailingGap > 0) {
    renderedItems.push(<li key={`gap:${tree.zoneCompound}:${previousIndex}:end`} aria-hidden="true" style={{ height: `${trailingGap}px` }} />);
  }

  return (
    <ul className={getClassName()} ref={listRef}>
      {tree.items.length === 0 && <div className={getClassName("helper")}>No items</div>}
      {renderedItems}
    </ul>
  );
};

export const LayerTree = ({ selectedId, selectedPathIds, trees }: any) => {
  return (
    <>
      {trees.map((tree: any) => (
        <LayerTreeZone depth={0} key={tree.zoneCompound} selectedId={selectedId} selectedPathIds={selectedPathIds} tree={tree} />
      ))}
    </>
  );
};
