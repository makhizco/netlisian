import { Config, DefaultComponentProps, Field, WithId, WithPuckProps } from "@measured/puck";

export type BuilderRootConfig = {
  _name: string;
  _version?: string;
  _versions?: string[];
  _fields?: {
    name: string;
    type: Field["type"];
  }[];
  _fieldSettings?: {
    [key: string]: any;
  };
};

export type BuilderComponentConfig = {
  _slot?: {
    slot: string;
  }[];
  _map?: {
    from: string | string[];
    to: string | string[];
    transform?: (inputs: any, props: DefaultComponentProps) => any;
    graphState?: {
      nodes: any[];
      edges: any[];
    };
  }[];
  [key: string]: any;
};

export type BuilderConfig = Config<any, BuilderRootConfig>;
