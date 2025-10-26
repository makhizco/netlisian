import { ReactElement, ReactNode } from "react";
import { BuilderComponentConfig, BuilderRootConfig } from "./BuilderConfig";
import { DefaultComponentProps, Field } from "@measured/puck";

type RenderFunc<
  Props extends { [key: string]: any } = { children: ReactNode },
> = (props: Props) => ReactElement;

export type Overrides = {
  map?: RenderFunc<{
    rootProps: BuilderRootConfig;
    toOptions: {
      label: string;
      value: string;
      type: Field["type"];
    }[];
    fromOptions: {
      label: string;
      value: string;
      type: Field["type"];
    }[];
    props: DefaultComponentProps;
    value: BuilderComponentConfig["_map"];
    onChange: (value: BuilderComponentConfig["_map"]) => void;
    id: string;
  }>;
};
