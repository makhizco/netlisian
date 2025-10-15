import type { Config } from "@measured/puck";
import { Container } from "../components/container";
import { Text } from "../components/text";
import { initialData } from "./initial-data";

export type ComponentProps = {
  text: any;
  container: any;
};

type RootProps = {
  title: string;
};

export const config: Config<ComponentProps, RootProps> = {
  components: {
    container: Container,
    text: Text,
  },
  categories: {},
  root: {},
};

export const componentKey = Buffer.from(
  `${Object.keys(config.components).join("-")}-${JSON.stringify(initialData)}`
).toString("base64");

export default config;
