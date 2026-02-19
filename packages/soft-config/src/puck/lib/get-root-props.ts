import { AppState, Field } from "@measured/puck";
import { BuilderRootConfig } from "../types/BuilderConfig";

export const getRootProps = (appState: AppState): BuilderRootConfig =>
  appState.data.root.props as BuilderRootConfig;
