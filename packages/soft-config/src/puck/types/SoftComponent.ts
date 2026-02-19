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
  name: string;
  category?: string;
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
  name: string;
  category?: string;
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
  /**
   * Dependencies map: version -> Set of component names this component depends on
   * Automatically inferred from component structure but can be overridden
   */
  dependencies?: {
    [version: string]: Set<string>;
  };
};

export type SoftComponents = Record<string, VersionedSoftComponent>;
