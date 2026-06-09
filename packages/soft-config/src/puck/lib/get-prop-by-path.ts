"use client";
export function getPropertyByPath(props: any, path: string): any {
  return path
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .reduce((o, key) => (o ? o[key] : undefined), props);
}
