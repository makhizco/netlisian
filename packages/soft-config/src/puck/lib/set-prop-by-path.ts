export function setPropertyByPath(props: any, path: string, value: any) {
  const parts = path.split(".");
  const last = parts.pop()!;
  let cur = props;
  for (const p of parts) {
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[last] = value;
}
