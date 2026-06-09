"use client";
import { AppState, Field } from "@puckeditor/core";
import { BuilderRootConfig } from "../types/BuilderConfig";

export const getRootProps = (appState: AppState): BuilderRootConfig =>
  appState.data.root.props as BuilderRootConfig;
