import { getFieldSettingsByPath } from "../get-settings-by-path";
import { setPropertyByPath } from "../set-prop-by-path";

export const resolveSoftComponentData = (
  props: {
    [x: string]: any;
    _map?: { to: string; from: string }[];
    id: string;
  },
  _fieldSettings: Record<string, any> = {}
): {
  [x: string]: any;
  id: string;
} => {
  const map = props._map;
  const newProps: any = { ...props };

  map?.forEach(({ from, to }) => {
    const setting = getFieldSettingsByPath(_fieldSettings, from);
    const defaultValue = setting?.defaultValue;
    const originalValue = getFieldSettingsByPath(props, to);
    const value = defaultValue !== undefined ? defaultValue : originalValue;

    setPropertyByPath(newProps, to, value);
  });

  return newProps;
};
