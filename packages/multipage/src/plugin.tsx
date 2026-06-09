import React from "react";
import type { Plugin } from "@measured/puck";
import { MultipageActionBar } from "./MultipageActionBar";
import { MultipageComponentOverlay } from "./MultipageComponentOverlay";

export interface MultipagePluginOptions {
  /**
   * Optional custom wrapper that replaces `<ActionBar>` inside MultipageActionBar.
   * Receives the built-in action bar groups as `children`.
   *
   * @example
   * createMultipagePlugin({
   *   customActionBar: ({ children }) => (
   *     <MyCustomShell>{children}</MyCustomShell>
   *   ),
   * });
   */
  customActionBar?: React.ComponentType<{ children: React.ReactNode }>;
}

export const createMultipagePlugin = (options: MultipagePluginOptions = {}): Plugin => {
  const { customActionBar } = options;

  return {
    overrides: {
      // Pass customActionBar through — MultipageActionBar falls back to <ActionBar> when undefined
      actionBar: (props) => (
        <MultipageActionBar {...props} customActionBar={customActionBar} />
      ),
      componentOverlay: (props) => <MultipageComponentOverlay {...props} />,
    },
  };
};
