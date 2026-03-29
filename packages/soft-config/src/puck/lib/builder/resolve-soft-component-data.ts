import { DefaultComponentProps } from "@measured/puck";
import { applyMapping } from "../apply-mapping";
import type { MapEntry } from "../../types/Mapping";

export const resolveSoftComponentData = (
  props: {
    [x: string]: any;
    _map?: MapEntry[];
    id: string;
  },
  _fieldSettings: Record<string, any> = {}
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

  return newProps as typeof props;
};
