import React from "react";
import { type Plugin } from "@measured/puck";
import { MultipageActionBar } from "./MultipageActionBar";
import { MultipageComponentOverlay } from "./MultipageComponentOverlay";
import style from "./style.module.css";

interface MultipagePluginOptions {
  actionBar?: React.ComponentType<any>;
}

/**
 * Creates the Multipage Plugin for Puck.
 * This plugin provides custom overrides for the editor UI:
 * - `actionBar`: Positioned and rendered dynamically on top of the active component selection.
 * - `componentOverlay`: Custom bounding boxes indicating component selection and hover states.
 * - `puck`: Inject styles for the multipage overrides.
 *
 * @param options - Configuration options for the multipage plugin.
 * @returns A Puck Plugin configuration object containing custom overrides.
 */
export const createMultipagePlugin = (options?: MultipagePluginOptions): Plugin => {
  return {
    overrides: {
      actionBar: (props) => (
        <MultipageActionBar {...props} BaseActionBar={options?.actionBar} />
      ),
      componentOverlay: (props) => <MultipageComponentOverlay {...props} />,
      puck: (props) => (
        <div className={style.multipageOverrides}>{props.children}</div>
      ),
    },
  };
};
