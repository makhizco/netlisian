"use client";
import { Config } from "@measured/puck";
import type { SoftFieldDefinition, SoftFieldSettings } from "./SoftFields";
import type { MapEntry } from "./Mapping";

export type BuilderRootConfig = {
  _name: string;
  _category?: string;
  _version?: string;
  _versions?: string[];
  _fields?: SoftFieldDefinition[];
  _fieldSettings?: SoftFieldSettings;
  [key: string]: unknown;
};

export type GlobalRootProps = {
  title?: string;
  _title?: string;
  _name?: string;
  _category?: string;
  [key: string]: any;
};

export type BuilderComponentConfig = {
  _slot?: {
    slot: string;
  }[];
  _map?: MapEntry[];
  [key: string]: unknown;
};

export type BuilderConfig = Config<any, BuilderRootConfig>;
