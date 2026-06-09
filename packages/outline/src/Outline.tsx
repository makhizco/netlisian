import { buildLayerTree, LayerTree } from "./LayerTree";
import { ComponentData, createUsePuck, Data } from "@measured/puck";
import { useMemo } from "react";
import { findZonesForArea } from "./data/find-zones-for-area";

const usePuck = createUsePuck();

export type ZoneType = "root" | "dropzone" | "slot";

export type PuckNodeData = {
  data: ComponentData;
  flatData: ComponentData;
  parentId: string | null;
  zone: string;
  path: string[];
};

export type PuckZoneData = {
  contentIds: string[];
  type: ZoneType;
};

export type NodeIndex = Record<string, PuckNodeData>;
export type ZoneIndex = Record<string, PuckZoneData>;

const EMPTY_INDEXES: { nodes: NodeIndex; zones: ZoneIndex } = {
  nodes: {},
  zones: {},
};

export const Outline = () => {
  const { nodes, zones } = usePuck(
    (s) =>
      s.history.histories[s.history.index]?.state?.indexes ?? EMPTY_INDEXES,
  ) as {
    nodes: NodeIndex;
    zones: ZoneIndex;
  };

  const appState = usePuck((s) => s.appState);
  const config = usePuck((s) => s.config);

  const selectedId = appState?.ui?.itemSelector
    ? appState.ui.itemSelector.zone === "root"
      ? zones["root"]?.contentIds[appState.ui.itemSelector.index]
      : zones[appState.ui.itemSelector.zone!]?.contentIds[
          appState.ui.itemSelector.index
        ]
    : null;

  const rootZones = useMemo(
    () => findZonesForArea(zones, "root"),
    [zones],
  );

  const selectedPathIds = useMemo(() => {
    const selectedPath = selectedId ? nodes[selectedId]?.path : null;
    return new Set(
      selectedPath
        ?.map((candidate: string) => candidate.split(":")[0])
        .filter(Boolean) || [],
    );
  }, [nodes, selectedId]);

  const trees = useMemo(
    () =>
      rootZones.map((zoneCompound: string) =>
        buildLayerTree({
          config,
          label: rootZones.length === 1 ? "" : zoneCompound.split(":")[1],
          nodes,
          zoneCompound,
          zones,
        }),
      ),
    [config, nodes, rootZones, zones],
  );

  return (
    <div>
      <LayerTree
        selectedId={selectedId}
        selectedPathIds={selectedPathIds}
        trees={trees}
      />
    </div>
  );
};
