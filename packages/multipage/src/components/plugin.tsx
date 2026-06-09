import React from "react";
import { type Plugin } from "@measured/puck";
import { MultipageActionBar } from "./MultipageActionBar";
import { MultipageComponentOverlay } from "./MultipageComponentOverlay";
import style from "./style.module.css";

/**
 * Creates the Multipage Plugin for Puck.
 * This plugin provides custom overrides for the editor UI:
 * - `actionBar`: Positioned and rendered dynamically on top of the active component selection.
 * - `componentOverlay`: Custom bounding boxes indicating component selection and hover states.
 * - `puck`: Inject styles for the multipage overrides.
 *
 * @returns A Puck Plugin configuration object containing custom overrides.
 */
export const createMultipagePlugin = (): Plugin => {
  return {
    overrides: {
      actionBar: (props) => <MultipageActionBar {...props} />,
      componentOverlay: (props) => <MultipageComponentOverlay {...props} />,
      puck: (props) => (
        <div className={style.multipageOverrides}>{props.children}</div>
      ),
    },
  };
};
