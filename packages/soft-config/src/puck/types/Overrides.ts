import { ReactElement, ReactNode } from "react";
import { BuilderComponentConfig, BuilderRootConfig } from "./BuilderConfig";
import {
  AsFieldProps,
  DefaultComponentProps,
  Field,
  Metadata,
  ResolveDataTrigger,
  RootData,
  WithChildren,
} from "@measured/puck";
import { VersionedSoftComponent } from "./SoftComponent";
import { OnActionsCallback } from "./ActionEvents";

type RenderFunc<
  Props extends { [key: string]: any } = { children: ReactNode },
> = (props: Props) => ReactElement;

export type Overrides = {
  componentNameToKey?: (
    displayName: string,
    context: Partial<BuilderRootConfig> & {
      existingKeys: string[];
      state: "building" | "remodeling" | "ready" | "inspecting";
    }
  ) => string;
  componentKeyToName?: (key: string) => string;
  onRemodel?: (key: string) => Record<string, any>;
  additionalRootFields?: Record<string, Field>;
  map?: RenderFunc<{
    rootProps: BuilderRootConfig;
    toOptions: {
      label: string;
      value: string;
      type: Field["type"] | "reference";
    }[];
    fromOptions: {
      label: string;
      value: string;
      type: Field["type"] | "reference";
    }[];
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
  ) => ((inputs: any[], props: DefaultComponentProps) => any) | undefined;
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
    }
  ) => {
    props:
      | RootData<AsFieldProps<WithChildren<BuilderRootConfig>>>
      | Promise<RootData<AsFieldProps<WithChildren<BuilderRootConfig>>>>;
    readOnly: Readonly<Record<string, boolean>> | undefined;
  };
};
