import { ContainerElement } from "../utilities/container-elements";
import { Prettify } from "../utilities/pretifiy";
import { Base } from "./BaseFields";
import { Slot } from "@measured/puck";

export type ContainerProps = Prettify<
  {
    element: ContainerElement;
    slot?: {
      className?: string;
      style?: {
        key: string;
        value: string;
      }[];
      allow?: string[];
      disallow?: string[];
    };
    slotItem: Slot;
  } & Base
>;
