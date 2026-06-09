"use client";

import { createUsePuck } from "@puckeditor/core";
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RepeatRenderProps,
  filterClasses,
  getComponentLabel,
  RepeatContent,
} from "./shared";
import {
  getRepeatComponentRegistry,
  subscribeRepeatComponentRegistry,
} from "./registry";

interface CustomFieldProps {
  value: unknown;
  onChange: (value: string) => void;
  id: string;
}

const useCustomPuck = createUsePuck();

const useRepeatRegistry = () => {
  const config = useCustomPuck((s) => s.config);
  const registry = React.useSyncExternalStore(
    subscribeRepeatComponentRegistry,
    getRepeatComponentRegistry,
    getRepeatComponentRegistry,
  );
  const fallbackCategory = "Other Components";

  const groupedOptions = useMemo(() => {
    const groups: Record<string, { key: string; label: string }[]> = {};
    const catMap = new Map<string, string>();

    Object.entries(config.categories || {}).forEach(([catKey, cat]) => {
      (cat.components || []).forEach((compKey) =>
        catMap.set(compKey, cat.title || catKey),
      );
    });

    Object.entries(registry).forEach(([key, comp]) => {
      if (key === "repeat") return;
      const cat = catMap.get(key) || fallbackCategory;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ key, label: getComponentLabel(key, comp) });
    });

    Object.entries(config.components).forEach(([key, comp]) => {
      if (key === "repeat" || registry[key]) return;
      const cat = catMap.get(key) || fallbackCategory;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ key, label: getComponentLabel(key, comp) });
    });

    return groups;
  }, [config, registry]);

  return { groupedOptions };
};

export const ComponentPickerField = ({
  value,
  onChange,
  id,
}: CustomFieldProps) => {
  const { groupedOptions } = useRepeatRegistry();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedOptions;

    const lowerQuery = searchQuery.toLowerCase();
    const filtered: Record<string, { key: string; label: string }[]> = {};

    Object.entries(groupedOptions).forEach(([cat, opts]) => {
      const matches = opts.filter((o) =>
        o.label.toLowerCase().includes(lowerQuery),
      );
      if (matches.length > 0) filtered[cat] = matches;
    });

    return filtered;
  }, [groupedOptions, searchQuery]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Search components..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded-md border border-zinc-200 bg-zinc-100 px-2 py-2 text-[13px] text-zinc-950"
      />
      <select
        id={id}
        title="Select component"
        value={String(value || "")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-950"
      >
        <option value="" disabled>
          Select a component
        </option>
        {Object.entries(filteredGroups).map(([category, options]) => (
          <optgroup key={category} label={category}>
            {options.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

export const adminRender = (props: RepeatRenderProps) => {
  const localRef = useRef<HTMLDivElement>(null);
  const [parentClasses, setParentClasses] = useState("");

  const deferredItems = useDeferredValue(props.items);

  const rendererProps = useMemo(() => {
    return {
      ...props,
      items: deferredItems,
    };
  }, [props, deferredItems]);

  const dragRefRef = useRef(props.puck.dragRef);
  dragRefRef.current = props.puck.dragRef;

  const setMergedRef = useCallback((node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof dragRefRef.current === "function") {
      dragRefRef.current(node);
    }
  }, []);

  useEffect(() => {
    if (!localRef.current?.parentElement) return;

    const parentNode = localRef.current.parentElement;
    const classList = filterClasses(parentNode.className);

    setParentClasses((prev) => (prev !== classList ? classList : prev));
  }, [props.component, props.items]);

  return (
    <div ref={setMergedRef} className={parentClasses || undefined}>
      <RepeatContent {...rendererProps} />
    </div>
  );
};
