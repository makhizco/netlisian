import { ReactElement, ReactNode } from "react";
import { BuilderComponentConfig, BuilderRootConfig } from "./BuilderConfig";
import {
  AsFieldProps,
  ComponentConfig,
  DefaultComponentProps,
  Field,
  Metadata,
  ResolveDataTrigger,
  RootData,
  WithChildren,
} from "@measured/puck";
import { VersionedSoftComponent } from "./SoftComponent";
import { OnActionsCallback } from "./ActionEvents";
import type { MappingOption } from "./Mapping";
import { Status } from "../store";

type RenderFunc<
  Props extends Record<string, unknown> = { children: ReactNode },
> = (props: Props) => ReactElement;

export type Overrides = {
  componentLabelToName?: (
    label: string,
    context: Partial<BuilderRootConfig> & {
      existingKeys: string[];
      state: Status;
    },
  ) => string;
  componentNameToLabel?: (name: string) => string;
  onRemodel?: (name: string) => Record<string, unknown>;
  additionalRootFields?: Record<string, Field>;
  map?: RenderFunc<{
    rootProps: BuilderRootConfig;
    toOptions: MappingOption[];
    fromOptions: MappingOption[];
    props: DefaultComponentProps;
    value: BuilderComponentConfig["_map"];
    onChange: (value: BuilderComponentConfig["_map"]) => void;
    id: string;
  }>;
  hydrateMapTransform?: (
    mapItem: NonNullable<BuilderComponentConfig["_map"]>[number],
    context: {
      componentName: string;
      version: string;
      subComponentPath: string[];
      softComponent: VersionedSoftComponent["versions"][string];
    },
  ) =>
    | ((inputs: unknown[], props: Record<string, unknown>) => unknown)
    | undefined;
  onActions?: OnActionsCallback;
  name?: Field<string>;
  categories?: Field<string | undefined>;
  resolveRootData?: (
    props: RootData<AsFieldProps<WithChildren<BuilderRootConfig>>>,
    params: {
      changed: Partial<
        Record<keyof BuilderRootConfig, boolean> & {
          id: string;
        }
      >;
      lastData: RootData<AsFieldProps<WithChildren<BuilderRootConfig>>> | null;
      metadata: Metadata;
      trigger: ResolveDataTrigger;
    },
    context: {
      editingComponent?: string;
    },
  ) => {
    props:
    | RootData<AsFieldProps<WithChildren<BuilderRootConfig>>>
    | Promise<RootData<AsFieldProps<WithChildren<BuilderRootConfig>>>>;
    readOnly: Readonly<Record<string, boolean>> | undefined;
  };
  mapComponentConfig?: (
    componentName: string,
    defaultConfig: ComponentConfig,
    rootProps: BuilderRootConfig & RootData,
  ) => ComponentConfig;
};
