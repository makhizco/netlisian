import { DefaultComponentProps, Fields } from "@measured/puck";
import { BuilderComponentConfig } from "./BuilderConfig";

export type SoftSubComponent = {
  type: string;
  map: BuilderComponentConfig['_map'];
  components: { [slot: string]: SoftSubComponent };
  fixedProps?: DefaultComponentProps;
  enabledSlots: {
    slot: string;
    name?: string;
  }[];
}[];

export type SoftComponent = {
  fields: Fields;
  fieldSettings?: Record<string, any>;
  defaultProps: DefaultComponentProps;
  components: SoftSubComponent;
  slots: {
    [slot: string]: DefaultComponentProps;
  };
};

export type VersionedSoftComponent = {
  defaultVersion: string;
  versions: {
    [version: string]: {
      fields: Fields;
      fieldSettings?: Record<string, any>;
      defaultProps: DefaultComponentProps;
      components: SoftSubComponent;
      slots: {
        [slot: string]: DefaultComponentProps;
      };
    };
  };
};

export type SoftComponents = Record<string, VersionedSoftComponent>;
