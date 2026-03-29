export function getFieldSettingsByPath(fieldSettings: {
  [x: string]: any;
}, path: string): any {
  return path.split(".").reduce((o, key) => (o ? o[key] : undefined), fieldSettings);
}
