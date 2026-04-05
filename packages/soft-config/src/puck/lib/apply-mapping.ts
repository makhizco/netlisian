/**
 * Shared helper: evaluates `_map` entries and applies mapped values to component props.
 *
 * Used by both the live builder effect (root-config.tsx) and the runtime
 * resolver (resolve-soft-component-data.ts) so the logic stays in one place.
 *
 * Array construction order (for array targets like `items[].imageUrl`):
 *   1. Start from `unmappedArrayItemDefaultValues` on the map entry (initially populated
 *      from the component's `defaultItemProps`). These are the single source of
 *      truth for the item "template".
 *   2. Overlay the mapped value for each array index.
 *   The result is a freshly-constructed array whose length equals the mapped
 *   source array and whose unmapped props come from the defaults above.
 */

import equal from "react-fast-compare";
import { setPropertyByPath } from "./set-prop-by-path";
import {
  getArrayBasePath,
  getArrayItemSubPath,
  isArrayMappingPath,
} from "./array-field-utils";
import type {
  ApplyMappingOptions,
  ApplyMappingResult,
  MapEntry,
} from "../types/Mapping";

export const resolveValueByPath = (source: any, path: string): any => {
  if (!path) return source;

  const segments = path.split(".");

  const resolveSegments = (current: any, index: number): any => {
    if (current === null || current === undefined) return undefined;
    if (index >= segments.length) return current;

    const segment = segments[index];

    if (segment.endsWith("[]")) {
      const arrayKey = segment.slice(0, -2);
      const arraySource = arrayKey ? current?.[arrayKey] : current;
      const resolvedArray = Array.isArray(arraySource)
        ? arraySource
        : Array.isArray(arraySource?.defaultValue)
          ? arraySource.defaultValue
          : undefined;

      if (!resolvedArray) return undefined;
      if (index === segments.length - 1) return resolvedArray;

      return resolvedArray.map((item: any) => resolveSegments(item, index + 1));
    }

    return resolveSegments(current[segment], index + 1);
  };

  return resolveSegments(source, 0);
};

const resolveFieldSettingEntryByPath = (
  settings: Record<string, any>,
  path: string
): any => {
  if (!path) return undefined;

  const segments = path.split(".");
  let currentSettings: Record<string, any> | undefined = settings;
  let currentEntry: any;

  for (const segmentWithArraySuffix of segments) {
    const segment = segmentWithArraySuffix.endsWith("[]")
      ? segmentWithArraySuffix.slice(0, -2)
      : segmentWithArraySuffix;

    if (!currentSettings || typeof currentSettings !== "object") {
      return undefined;
    }

    currentEntry = currentSettings[segment];
    if (currentEntry === undefined) {
      return undefined;
    }

    currentSettings = currentEntry?.subFieldSettings;
  }

  return currentEntry;
};

/**
 * Evaluate every `_map` entry and apply the results to `props`.
 *
 * @param props         The component props to mutate (caller should pass a shallow copy).
 * @param fieldSettings Root-level `_fieldSettings` for resolving `from` paths.
 * @param map           The `_map` array from the component.
 * @param resolveInput  Strategy for resolving `from` values. Two modes:
 * - `"fieldSettings"` (builder): read from `fieldSettings` only.
 * - `"propsFirst"` (runtime): prefer live prop values, fall back
 * to fieldSettings `defaultValue`.
 */
export function applyMapping(
  props: Record<string, any>,
  fieldSettings: Record<string, any>,
  map: MapEntry[],
  resolveInput: "fieldSettings" | "propsFirst" = "fieldSettings",
  options?: ApplyMappingOptions
): ApplyMappingResult {
  const newProps: Record<string, any> = { ...props };
  const sourceProps = options?.sourceProps ?? props;
  const mappedArrayPaths = new Set<string>();
  let changed = false;
  const changedArrayBases = new Set<string>();

  for (const entry of map) {
    const { from, to, transform } = entry;
    if (!from || !to) continue;

    const fromPaths = Array.isArray(from) ? from : [from];
    const toPaths = Array.isArray(to) ? to : [to];

    const hasInvalidPair = fromPaths.some((fp, idx) => {
      const tp = toPaths[idx] || toPaths[0];
      if (typeof fp !== "string" || typeof tp !== "string") return false;
      return isArrayMappingPath(fp) && !isArrayMappingPath(tp);
    });
    if (hasInvalidPair) continue;

    const inputValues = fromPaths.map((f) => {
      if (resolveInput === "propsFirst") {
        const propVal = resolveValueByPath(sourceProps, f);
        if (propVal !== undefined) return propVal;

        const setting = resolveValueByPath(fieldSettings, f);
        if (
          setting &&
          Object.prototype.hasOwnProperty.call(setting, "defaultValue")
        ) {
          return setting.defaultValue;
        }
        return propVal;
      }
      const directValue = resolveValueByPath(fieldSettings, f);
      if (directValue !== undefined) {
        return directValue;
      }

      return resolveFieldSettingEntryByPath(fieldSettings, f);
    });

    const resolvedInputs = inputValues.map((v) =>
      resolveInput === "fieldSettings" ? v?.defaultValue : v
    );
    let result = transform ? transform(resolvedInputs, newProps) : inputValues[0];

    if (
      resolveInput === "fieldSettings" &&
      !transform &&
      result !== undefined &&
      typeof result === "object" &&
      result !== null &&
      "defaultValue" in result
    ) {
      result = result.defaultValue;
    }

    const isSingleArrayTarget =
      toPaths.length === 1 &&
      typeof toPaths[0] === "string" &&
      isArrayMappingPath(toPaths[0]);

    if (isSingleArrayTarget) {
      const toPath = toPaths[0] as string;
      const arrayBase = getArrayBasePath(toPath);
      const subProp = getArrayItemSubPath(toPath) || "";
      if (!arrayBase) continue;

      const defaultArray = Array.isArray(options?.arrayDefaults?.[arrayBase])
        ? options?.arrayDefaults?.[arrayBase]
        : [];
      const currentArrayAtPath = resolveValueByPath(newProps, arrayBase);
      const currentArray = Array.isArray(currentArrayAtPath)
        ? currentArrayAtPath
        : [];

      const isFromArrayPath =
        typeof fromPaths[0] === "string" && isArrayMappingPath(fromPaths[0]);

      const sourceArray = isFromArrayPath
        ? Array.isArray(result)
          ? result
          : result !== undefined
            ? [result]
            : []
        : Array.isArray(result)
          ? result
          : defaultArray.map(() => result);

      let defaults: Record<string, any> =
        entry.unmappedArrayItemDefaultValues ||
        entry.defaultOverrides ||
        {};

      if (typeof defaults === "string") {
        try {
          defaults = JSON.parse(defaults);
        } catch (e) {
          defaults = {};
        }
      }

      const targetLength = sourceArray.length;

      const constructed = Array.from({ length: targetLength }).map((_, idx) => {
        const mappedValue = sourceArray[idx];
        const defaultItem =
          defaultArray[idx] && typeof defaultArray[idx] === "object"
            ? defaultArray[idx]
            : {};
        const currentItem =
          currentArray[idx] && typeof currentArray[idx] === "object"
            ? currentArray[idx]
            : {};
        const item: Record<string, any> = {
          ...defaultItem,
          ...defaults,
          ...currentItem,
        };

        if (subProp && mappedValue !== undefined) {
          setPropertyByPath(item, subProp, mappedValue);
        }

        return item;
      });

      // Multiple `_map` rows can target the same array base. Build the final
      // array from the current props so sibling rows compose instead of
      // overwriting each other and re-triggering no-op replace dispatches.
      const originalArray = resolveValueByPath(newProps, arrayBase);
      if (!equal(originalArray, constructed)) {
        setPropertyByPath(newProps, arrayBase, constructed);
        changedArrayBases.add(arrayBase);
      }

      mappedArrayPaths.add(arrayBase);
    } else if (toPaths.length === 1 && Array.isArray(result) && toPaths[0].includes("array")) {
      const toPath = toPaths[0];
      const original = resolveValueByPath(newProps, toPath);
      if (!equal(original, result)) {
        setPropertyByPath(newProps, toPath, result);
        changed = true;
      }
    } else if (Array.isArray(result) && toPaths.length > 1) {
      result.forEach((val: any, idx: number) => {
        if (toPaths[idx]) {
          const orig = resolveValueByPath(newProps, toPaths[idx]);
          if (!equal(orig, val)) {
            setPropertyByPath(newProps, toPaths[idx], val);
            changed = true;
          }
        }
      });
    } else if (toPaths[0]) {
      const finalValue = result;
      const originalValue = resolveValueByPath(newProps, toPaths[0]);

      if (!equal(originalValue, finalValue)) {
        setPropertyByPath(newProps, toPaths[0], finalValue);
        changed = true;
      }
    }
  }

  // Only report a change when the final array value differs from the input.
  // This prevents the builder root effect from dispatching replace actions for
  // transient intermediate states produced while composing multiple array maps.
  const hasNetArrayChanges = Array.from(changedArrayBases).some((arrayBase) =>
    !equal(resolveValueByPath(props, arrayBase), resolveValueByPath(newProps, arrayBase))
  );

  return { newProps, mappedArrayPaths, changed: changed || hasNetArrayChanges };
}
