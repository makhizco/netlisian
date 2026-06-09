import { DefaultComponentProps } from "@puckeditor/core";

"use client";
import equal from "react-fast-compare";
import { setImmutablePropertyByPath } from "./set-prop-by-path";
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


/**
 * Caches split path segments to optimize repeated deep object lookups
 * during high-frequency rendering and mapping cycles.
 */
const pathSegmentsCache = new Map<string, string[]>();

const getPathSegments = (path: string): string[] => {
  let segments = pathSegmentsCache.get(path);
  if (!segments) {
    segments = path.split(".");
    pathSegmentsCache.set(path, segments);
  }
  return segments;
};

export const resolveValueByPath = (source: unknown, path: string): unknown => {
  if (!path) return source;

  const segments = getPathSegments(path);

  const resolveSegments = (current: unknown, index: number): unknown => {
    if (current === null || current === undefined) return undefined;
    if (index >= segments.length) return current;

    const segment = segments[index];

    if (segment.endsWith("[]")) {
      const arrayKey = segment.slice(0, -2);
      const arraySource = arrayKey ? (current as DefaultComponentProps)?.[arrayKey] : current;
      const resolvedArray = Array.isArray(arraySource)
        ? arraySource
        : Array.isArray((arraySource as DefaultComponentProps)?.defaultValue)
          ? (arraySource as DefaultComponentProps).defaultValue
          : undefined;

      if (!resolvedArray) return undefined;
      if (index === segments.length - 1) return resolvedArray;

      return resolvedArray.map((item: unknown) => resolveSegments(item, index + 1));
    }

    return resolveSegments((current as DefaultComponentProps)[segment], index + 1);
  };

  return resolveSegments(source, 0);
};

const resolveFieldSettingEntryByPath = (
  settings: DefaultComponentProps,
  path: string
): unknown => {
  if (!path) return undefined;

  const segments = getPathSegments(path);
  let currentSettings: DefaultComponentProps | undefined = settings;
  let currentEntry: unknown;

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

    currentSettings = (currentEntry as DefaultComponentProps)?.subFieldSettings as DefaultComponentProps;
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
  props: DefaultComponentProps,
  fieldSettings: DefaultComponentProps,
  map: MapEntry[],
  resolveInput: "fieldSettings" | "propsFirst" = "fieldSettings",
  options?: ApplyMappingOptions
): ApplyMappingResult {
  let newProps: DefaultComponentProps = props; // Copy-on-write reference
  const sourceProps = options?.sourceProps ?? props;
  const mappedArrayPaths = new Set<string>();
  let changed = false;

  // Group array mapping rules by their arrayBase to batch processing
  const arrayRulesMap = new Map<string, Array<{ entry: MapEntry; toPath: string; fromPaths: string[], result: unknown }>>();

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
          return (setting as Record<string, any>).defaultValue;
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
      if (!arrayBase) continue;

      let rules = arrayRulesMap.get(arrayBase);
      if (!rules) {
        rules = [];
        arrayRulesMap.set(arrayBase, rules);
      }
      rules.push({ entry, toPath, fromPaths, result });
      mappedArrayPaths.add(arrayBase);
      continue;
    }

    // Process non-array targets immediately using copy-on-write
    if (toPaths.length === 1 && Array.isArray(result) && toPaths[0].includes("array")) {
      const toPath = toPaths[0];
      const original = resolveValueByPath(newProps, toPath);
      if (!equal(original, result)) {
        newProps = setImmutablePropertyByPath(newProps, toPath, result);
        changed = true;
      }
    } else if (Array.isArray(result) && toPaths.length > 1) {
      result.forEach((val: unknown, idx: number) => {
        if (toPaths[idx]) {
          const orig = resolveValueByPath(newProps, toPaths[idx]);
          if (!equal(orig, val)) {
            newProps = setImmutablePropertyByPath(newProps, toPaths[idx], val);
            changed = true;
          }
        }
      });
    } else if (toPaths[0]) {
      const finalValue = result;
      const originalValue = resolveValueByPath(newProps, toPaths[0]);

      if (!equal(originalValue, finalValue)) {
        newProps = setImmutablePropertyByPath(newProps, toPaths[0], finalValue);
        changed = true;
      }
    }
  }

  /**
   * Batch process all array-targeted mappings.
   * By grouping rules by their base array path, we ensure that multiple mappings
   * targeting the same array construct a single, cohesive updated array instead of
   * overwriting each other or triggering redundant render cycles.
   */
  for (const [arrayBase, rules] of arrayRulesMap.entries()) {
    const defaultArray = Array.isArray(options?.arrayDefaults?.[arrayBase])
      ? options?.arrayDefaults?.[arrayBase]
      : [];
    const currentArrayAtPath = resolveValueByPath(newProps, arrayBase);
    const currentArray = Array.isArray(currentArrayAtPath) ? currentArrayAtPath : [];

    let targetLength = 0;

    // Resolve source arrays for each rule mapped to this base
    const ruleSourceArrays = rules.map(({ entry, fromPaths, result }) => {
      const isFromArrayPath = typeof fromPaths[0] === "string" && isArrayMappingPath(fromPaths[0]);

      const sourceArray = isFromArrayPath
        ? Array.isArray(result)
          ? result
          : result !== undefined
            ? [result]
            : []
        : Array.isArray(result)
          ? result
          : defaultArray.map(() => result);

      targetLength = Math.max(targetLength, sourceArray.length);
      return sourceArray;
    });

    const constructed = Array.from({ length: targetLength }).map((_, idx) => {
      const defaultItem = defaultArray[idx] && typeof defaultArray[idx] === "object" ? defaultArray[idx] : {};
      const currentItem = currentArray[idx] && typeof currentArray[idx] === "object" ? currentArray[idx] : {};

      // Combine all defaults from the batched rules
      let mergedDefaults: DefaultComponentProps = {};
      for (const rule of rules) {
        let ruleDefaults = rule.entry.unmappedArrayItemDefaultValues || rule.entry.defaultOverrides || {};
        if (typeof ruleDefaults === "string") {
          try { ruleDefaults = JSON.parse(ruleDefaults); } catch (e) { }
        }
        mergedDefaults = { ...mergedDefaults, ...(ruleDefaults as DefaultComponentProps) };
      }

      const baseItem = { ...(defaultItem as DefaultComponentProps), ...mergedDefaults };
      let newItem: DefaultComponentProps | undefined = undefined;

      // Check base defaults against currentItem
      for (const key of Object.keys(baseItem)) {
        if (!(key in currentItem) && baseItem[key] !== undefined) {
          if (!newItem) newItem = { ...currentItem };
          if (newItem) {
            newItem[key] = baseItem[key];
          }
        }
      }

      // Apply mapped properties from all rules
      for (let i = 0; i < rules.length; i++) {
        const { toPath } = rules[i];
        const subProp = getArrayItemSubPath(toPath) || "";
        const mappedValue = ruleSourceArrays[i][idx];

        if (subProp && mappedValue !== undefined) {
          const existingValue = resolveValueByPath(newItem || currentItem, subProp);
          if (!equal(existingValue, mappedValue)) {
            newItem = setImmutablePropertyByPath(newItem || currentItem, subProp, mappedValue);
          }
        }
      }

      return newItem !== undefined ? newItem : currentItem;
    });

    // Verify if the final constructed array structurally differs from currentArray
    let arrayChanged = currentArray.length !== constructed.length;
    if (!arrayChanged) {
      for (let i = 0; i < currentArray.length; i++) {
        if (currentArray[i] !== constructed[i]) {
          arrayChanged = true;
          break;
        }
      }
    }

    if (arrayChanged) {
      newProps = setImmutablePropertyByPath(newProps, arrayBase, constructed);
      changed = true;
    }
  }

  return { newProps, mappedArrayPaths, changed };
}
