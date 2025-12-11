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
    to: string | string[];
    from: string | string[];
    transform?: (inputs: any[], props: DefaultComponentProps) => any;
    [key: string]: any; // Props such as conditions, depends on custom function
  }[];
  [key: string]: any;
};

export type BuilderConfig = Config<any, BuilderRootConfig>;
