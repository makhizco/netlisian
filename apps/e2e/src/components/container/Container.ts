import { Base } from "./base";
import { ContainerElement } from "./container-elements";
import { LeafElement } from "./leaf-elements";
import { Slot } from "@puckeditor/core";

type Prettify<T> = {
  [K in keyof T]: T[K];
};


export type ContainerProps = Prettify<
  {
    element: ContainerElement | LeafElement;
    slot?: {
      className?: string;
      style?: {
        key: string;
        value: string;
      }[];
      allow?: string[];
      disallow?: string[];
    };
    noChild?: boolean;
    slotItem: Slot;
  } & Base
>;
