/**
 * Shared utility for managing component visibility and editing state styling
 * Sets a greyscale filter on all components except the ones being edited
 */

/**
 * Visibility context for the current editing session
 */
export type EditVisibilityContext = {
  /**
   * Component IDs currently being edited (not greyed out)
   * During build: Puck component UUIDs (from editableComponentIds)
   * During remodel: Root component paths (from decomposed components)
   */
  editableIds: Set<string>;

  /**
   * Optional: Component IDs to also highlight (e.g., dependencies)
   */
  highlightDependencyIds?: Set<string>;

  /**
   * Mode affects how styling is applied
   * - "build": Editing a component, show only editable components
   * - "remodel": Remodeling a component, show the component being remodeled and its structure
   * - "none": No editing, all components visible
   */
  mode: "build" | "remodel" | "none";
};

/**
 * Apply visibility styling to the iframe document
 * All components become greyed out except those in editableIds
 *
 * @param doc - The iframe document
 * @param context - Visibility context with editable IDs and mode
 */
export const setEditVisibility = (
  doc: Document | null,
  context: EditVisibilityContext
) => {
  if (!doc) return;

  try {
    // Apply greyscale filter to entire document when in editing mode
    const root = doc.documentElement;
  
    if (context.mode === "none") {
      // Remove any visibility styling
      root.removeAttribute("data-edit-mode");
      root.classList.remove("edit-visibility-mode");

      // Clear all component-level styling
      doc.querySelectorAll("[data-puck-component]").forEach((el) => {
        el.removeAttribute("data-edit-visibility");
        el.classList.remove("edit-visibility-greyed", "edit-visibility-editable", "edit-visibility-dependency");
      });
    } else {
      // Enable visibility mode
      root.setAttribute("data-edit-mode", context.mode);
      root.classList.add("edit-visibility-mode");

      // Style all components
      doc.querySelectorAll("[data-puck-component]").forEach((el) => {
        const id = el.getAttribute("data-puck-component");
        if (!id) return;

        const isEditable = context.editableIds.has(id);
        const isDependency = context.highlightDependencyIds?.has(id);

        if (isEditable) {
          el.setAttribute("data-edit-visibility", "editable");
          el.classList.remove("edit-visibility-greyed", "edit-visibility-dependency");
          el.classList.add("edit-visibility-editable");
        } else if (isDependency) {
          el.setAttribute("data-edit-visibility", "dependency");
          el.classList.remove("edit-visibility-greyed", "edit-visibility-editable");
          el.classList.add("edit-visibility-dependency");
        } else {
          el.setAttribute("data-edit-visibility", "greyed");
          el.classList.remove("edit-visibility-editable", "edit-visibility-dependency");
          el.classList.add("edit-visibility-greyed");
        }
      });
    }
  } catch (error) {
    console.warn(`Failed to set edit visibility:`, error);
  }
};

/**
 * Clear all visibility styling from the iframe document
 * @param doc - The iframe document
 */
export const clearEditVisibility = (doc: Document | null) => {
  if (!doc) return;

  try {
    const root = doc.documentElement;
    root.removeAttribute("data-edit-mode");
    root.classList.remove("edit-visibility-mode");

    doc.querySelectorAll("[data-puck-component]").forEach((el) => {
      el.removeAttribute("data-edit-visibility");
      el.classList.remove("edit-visibility-greyed", "edit-visibility-editable", "edit-visibility-dependency");
    });
  } catch (error) {
    console.warn(`Failed to clear edit visibility:`, error);
  }
};

/**
 * Get all component IDs from the iframe document
 * Useful for debugging and understanding the component tree
 *
 * @param doc - The iframe document
 * @returns Array of component IDs
 */
export const getAllComponentIds = (doc: Document | null): string[] => {
  if (!doc) return [];

  try {
    return Array.from(doc.querySelectorAll("[data-puck-component]"))
      .map((el) => el.getAttribute("data-puck-component"))
      .filter((id): id is string => Boolean(id));
  } catch (error) {
    console.warn(`Failed to get component IDs:`, error);
    return [];
  }
};
