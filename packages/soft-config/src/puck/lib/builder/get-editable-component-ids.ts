"use client";
import { ComponentData, Config, walkTree } from "@puckeditor/core";

/**
 * Collects all component IDs that should be editable during building/remodeling.
 * Includes the target component and all its descendants.
 */
export const getEditableComponentIds = (
  targetComponentId: string,
  data: ComponentData | undefined,
  config: Config
): Set<string> => {
  const editableIds = new Set<string>();
  let found = false;

  // Add the target component ID
  editableIds.add(targetComponentId);

  // If no data provided, return just the target
  if (!data) {
    return editableIds;
  }

  // Walk the tree to find all descendants of the target component
  walkTree(data, config, (content) => {
    content.forEach((component) => {
      if (found || component.props.id === targetComponentId) {
        found = true;
        editableIds.add(component.props.id);
      } else if (found) {
        editableIds.add(component.props.id);
      }
    });
    return content;
  });

  return editableIds;
};
