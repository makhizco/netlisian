import { DefaultComponentProps } from "@measured/puck";
import { getFieldSettingsByPath } from "../get-settings-by-path";
import { setPropertyByPath } from "../set-prop-by-path";

export const resolveSoftComponentData = (
  props: {
    [x: string]: any;
    _map?: {
      to?: string | string[];
      from?: string | string[];
      transform?: (inputs: any[], props: DefaultComponentProps) => any;
      [key: string]: any; // Props such as conditions, depends on custom function
    }[];
    id: string;
  },
  _fieldSettings: Record<string, any> = {}
): {
  [x: string]: any;
  id: string;
} => {
  const map = props._map;
  const newProps: any = { ...props };

  map?.forEach((item) => {
    const { from, to, transform } = item || {};
    const toPaths = Array.isArray(to) ? to : to ? [to] : [];
    if (!toPaths.length) return;

    const fromPaths = Array.isArray(from) ? from : from ? [from] : [];

    // Prefer live prop values; fall back to field defaultValue only when undefined
    const inputs = fromPaths.map((path) => {
      const propValue = getFieldSettingsByPath(props, path);
      if (propValue !== undefined) return propValue;

      const setting = getFieldSettingsByPath(_fieldSettings, path);
      if (setting && Object.prototype.hasOwnProperty.call(setting, "defaultValue")) {
        return setting.defaultValue;
      }
      return propValue;
    });

    const runner = transform
    const result = runner ? runner(inputs, props) : inputs[0];
    if (Array.isArray(result)) {
      result.forEach((val, idx) => {
        if (toPaths[idx]) setPropertyByPath(newProps, toPaths[idx], val);
      });
    } else {
      setPropertyByPath(newProps, toPaths[0], result);
    }
  });

  return newProps;
};
