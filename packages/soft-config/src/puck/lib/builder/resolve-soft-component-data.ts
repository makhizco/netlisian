"use client";

import { applyMapping } from "../apply-mapping";
import type { MapEntry } from "../../types/Mapping";

export const resolveSoftComponentData = (
  props: {
    [x: string]: any;
    _map?: MapEntry[];
    id: string;
  },
  _fieldSettings: Record<string, any> = {},
  keepMapField?: boolean
): {
  [x: string]: any;
  id: string;
} => {
  const map = props._map;
  if (!map?.length) return { ...props };

  const { newProps } = applyMapping(
    props,
    _fieldSettings,
    map,
    "propsFirst"
  );

  if (keepMapField) {
    return {
      ...newProps as typeof props,
      _map: map,
    }
  }
  return newProps as typeof props;
};
