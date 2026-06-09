"use client";
import React, { useState } from "react";
import { createUsePuck, Drawer as PuckDrawer, Config } from "@puckeditor/core";
const useCustomPuck = createUsePuck();
import { ChevronDown, ChevronUp } from "lucide-react";
import { DrawerItem } from "./DrawerItem";
import getClassNameFactory from "../lib/get-class-name-factory";
import styles from "./Drawer.module.css";

const getClassName = getClassNameFactory("Drawer", styles);
// Separate factory for the category wrapper -> .Drawer-category + .Drawer-category--isExpanded
const getCategoryClassName = getClassNameFactory("Drawer-category", styles);

type GetPermissions = (params: { type: string }) => { insert: boolean };

type Category = {
  title?: string;
  components?: string[];
  visible?: boolean;
  defaultExpanded?: boolean;
};

const CategorySection = ({
  id,
  title,
  componentKeys,
  getPermissions,
  expanded,
  onToggle,
}: {
  id: string;
  title?: string;
  componentKeys: string[];
  getPermissions: GetPermissions;
  expanded: boolean;
  onToggle: (id: string) => void;
}) => (
  <div className={getCategoryClassName({ isExpanded: expanded })}>
    {title && (
      <button
        type="button"
        className={getClassName("categoryTitle")}
        onClick={() => onToggle(id)}
        title={expanded ? `Collapse ${title}` : `Expand ${title}`}
      >
        <span>{title}</span>
        <span className={getClassName("categoryTitleIcon")}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
    )}
    <div className={getClassName("categoryContent")}>
      <PuckDrawer>
        {componentKeys.map((key) => (
          <PuckDrawer.Item
            key={key}
            name={key}
            isDragDisabled={!getPermissions({ type: key }).insert}
          >
            {DrawerItem}
          </PuckDrawer.Item>
        ))}
      </PuckDrawer>
    </div>
  </div>
);

/**
 * Drawer — custom drawer override for the Puck editor.
 *
 * Reads config.categories from puck and renders a collapsible section per
 * category, each containing a PuckDrawer with DrawerItem as the item
 * renderer (soft-config versioning, demolish, and settings modal included).
 * Components not assigned to any category render under "Other components".
 *
 * Falls back to a flat list when no categories are defined.
 *
 * Usage:
 *   overrides={{ drawer: Drawer }}
 */
export const Drawer = (_props: { children?: React.ReactNode }) => {
  const config = useCustomPuck((s) => s.config) as unknown as Config & {
    categories?: Record<string, Category>;
  };
  const getPermissions = useCustomPuck((s) => s.getPermissions) as any;

  const categories = config.categories ?? {};

  const categorised = new Set(
    Object.values(categories).flatMap((cat) => cat.components ?? []),
  );

  const allKeys = Object.keys(config.components);
  const labels = Object.entries(config.components).reduce(
    (acc, [key, comp]) => {
      acc[key] = comp.label || key;
      return acc;
    },
    {} as Record<string, string>,
  );
  const otherKeys = allKeys.filter((k) => !categorised.has(k));

  const categoryEntries = Object.entries(categories).filter(
    ([, cat]) => cat.visible !== false,
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    categoryEntries.forEach(([id, cat]) => {
      init[id] = cat.defaultExpanded !== false;
    });
    if (otherKeys.length > 0) init["__other__"] = true;
    return init;
  });

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (categoryEntries.length === 0) {
    return (
      <PuckDrawer>
        {allKeys.map((key) => (
          <PuckDrawer.Item
            key={key}
            name={key}
            label={labels[key]}
            isDragDisabled={!getPermissions({ type: key }).insert}
          >
            {DrawerItem}
          </PuckDrawer.Item>
        ))}
      </PuckDrawer>
    );
  }

  return (
    <div className={getClassName()}>
      {categoryEntries.map(([id, cat]) => (
        <CategorySection
          key={id}
          id={id}
          title={cat.title ?? id}
          componentKeys={(cat.components ?? []).filter(
            (k: string) => k in config.components,
          )}
          getPermissions={getPermissions}
          expanded={expanded[id] ?? true}
          onToggle={toggle}
        />
      ))}

      {otherKeys.length > 0 && (
        <CategorySection
          id="__other__"
          title="Other components"
          componentKeys={otherKeys}
          getPermissions={getPermissions}
          expanded={expanded["__other__"] ?? true}
          onToggle={toggle}
        />
      )}
    </div>
  );
};
