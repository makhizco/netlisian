import type { Config, Slot, WithPuckProps } from "@puckeditor/core";
import { Container } from "../components/container";
import { Text } from "../components/text";
import { initialData } from "./initial-data";
import { TextProps } from "../components/text/Text";
import { ContainerProps } from "../components/container/Container";
import { Repeat, RepeatProps } from "../components/repeat";
import {
  FlatContainer,
  FlatContainerProps,
} from "../components/flat-container";
import {
  DeepFlatContainer,
  DeepFlatContainerProps,
} from "../components/deep-flat-container";
// import { rootRender } from "./root-render";
// import React from "react";

export type ComponentProps = {
  text: TextProps;
  container: ContainerProps;
  repeat: RepeatProps;
  flatContainer: FlatContainerProps;
  deepFlatContainer: DeepFlatContainerProps;
};

export type RootProps = {
  title: string;
  // softSlot: Slot;
};

export const config: Config<ComponentProps, RootProps> = {
  components: {
    container: Container,
    text: Text,
    repeat: Repeat,
    flatContainer: FlatContainer,
    deepFlatContainer: DeepFlatContainer,
  },
  categories: {
    base: {
      components: [
        "text",
        "container",
        "repeat",
        "flatContainer",
        "deepFlatContainer",
      ],
      title: "Base",
      defaultExpanded: true,
    },
    blocks: {
      components: [],
      title: "Blocks",
      defaultExpanded: true,
    },
  },
  root: {
    fields: {
      title: {
        type: "text",
        label: "Title",
      },
      // softSlot: {
      //   type: "slot",
      //   label: "Soft Slot",
      // }
    },
    // render: rootRender
  },
};

export const componentKey = Buffer.from(JSON.stringify(initialData)).toString(
  "base64",
);

export default config;
