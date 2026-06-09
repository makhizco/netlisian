"use client";
/**
 * Mutates an object in-place to set a value at a specified dot-notated path.
 *
 * @param props - The target object to mutate.
 * @param path - The dot-notated or bracket-notated string path.
 * @param value - The value to set at the end of the path.
 */
export function setPropertyByPath(props: any, path: string, value: any) {
  const parts = path.replace(/\[(\w+)\]/g, ".$1").split(".");
  const last = parts.pop()!;
  let cur = props;
  for (const p of parts) {
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[last] = value;
}

/**
 * Immutably sets a value in an object at a specified dot-notated path,
 * returning a new copy of the object hierarchy modified along the path.
 *
 * @param obj - The source object.
 * @param path - The dot-notated or bracket-notated string path.
 * @param value - The value to set.
 * @returns A shallow copy of the object containing the new value.
 */
export function setImmutablePropertyByPath<T extends Record<string, any>>(
  obj: T,
  path: string,
  value: any
): T {
  if (!path) return value as any;
  const parts = path.replace(/\[(\w+)\]/g, ".$1").split(".");
  
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let current: any = root;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    
    // If the next part is a number, the structure should be an array
    const isArrayNext = !isNaN(Number(nextPart));
    
    if (current[part] === undefined || current[part] === null) {
      current[part] = isArrayNext ? [] : {};
    } else {
      current[part] = Array.isArray(current[part]) ? [...current[part]] : { ...current[part] };
    }
    
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
  
  return root as T;
}
