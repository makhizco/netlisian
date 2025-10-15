import { DefaultComponentProps, Fields } from "@measured/puck";

export type SoftSubComponent = {
  type: string;
  map: { from: string; to: string }[];
  components: { [slot: string]: SoftSubComponent };
  fixedProps?: DefaultComponentProps;
  enabledSlots: {
    slot: string;
    name?: string;
  }[];
}[];

export type SoftComponent = {
  fields: Fields;
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
      defaultProps: DefaultComponentProps;
      components: SoftSubComponent;
      slots: {
        [slot: string]: DefaultComponentProps;
      };
    };
  };
};

export type SoftComponents = Record<string, VersionedSoftComponent>;
