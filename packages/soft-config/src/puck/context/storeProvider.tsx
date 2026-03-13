"use client";

import { Config, PuckAction } from "@measured/puck";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { appStoreContext } from "./useStore";
import { createSoftConfigStore } from "../store";
import type { AppStore } from "../store";
import type { SoftComponents } from "../types/SoftComponent";
import type { Overrides } from "../types/Overrides";
import type { OnActionsCallback } from "../types/ActionEvents";
import type { StoreApi } from "zustand";
import { clearEditVisibility, setEditVisibility } from "../lib/edit-visibility-utils";
import { notify } from "../lib/notify";

export const SoftConfigProvider = ({
  children,
  hardConfig,
  softComponents,
  overrides,
  value,
  onActions,
  useVersioning = false,
}: {
  children: (
    softConfig: Config,
    softComponents: SoftComponents,
    iframeDoc: AppStore['setIframeDoc'],
    validateAction: (action: PuckAction) => boolean
  ) => ReactNode;
  hardConfig: Config;
  softComponents: SoftComponents;
  overrides?: Overrides;
  value?: StoreApi<AppStore>;
  onActions?: OnActionsCallback;
  useVersioning?: boolean;
}) => {
  const store = value ?? useMemo(
    () => createSoftConfigStore(hardConfig, softComponents, overrides, onActions, useVersioning),
    [hardConfig, softComponents, overrides, onActions, useVersioning]
  );
  const [softConfig, setSoftConfig] = useState(
    () => store.getState().softConfig
  );
  const [internalSoftComponents, setSoftComponents] = useState(
    () => store.getState().softComponents
  );
  const storeSetIframeDoc = useMemo(
    () => store.getState().setIframeDoc,
    [store]
  );

  const validateAction = useMemo(
    () => (action: PuckAction): boolean => {
      const currentState = store.getState();

      // Only validate actions when NOT in "ready" state
      if (currentState.state === "ready") {
        return true;
      }

      const editableIds = currentState.editableComponentIds;


      // replace is most frequent check it first
      if (action.type === "replace") {
        const parentId = action.destinationZone?.split(":")[0];
        if (action.data.props.id && (editableIds.has(action.data.props.id))) {
          return true;
        } else if (parentId && editableIds.has(parentId)) {
          // Add editable id of the new component
          currentState.addEditableComponentId(action.data.props.id);
          return true;
        }

        return false;
      }

      // Insert and Duplicate: validate parent zone
      if (action.type === "insert" || action.type === "duplicate") {
        const zone = action.type === "insert"
          ? action.destinationZone
          : action.sourceZone;

        const parentId = zone?.split(":")[0];
        if (parentId && !editableIds.has(parentId)) {
          return false;
        }

        // For insert/duplicate, add the new component to editable list
        if (action.type === "insert") {
          const childId = action.id;
          if (childId) {
            currentState.addEditableComponentId(childId);
          }
        }
        return true;
      }


      // Remove, Move, Reorder, Replace: validate component being edited
      if (
        action.type === "remove" ||
        action.type === "move" ||
        action.type === "reorder"
      ) {
        let parentId;
        if (action.type === "remove") {
          parentId = action.zone.split(":")[0];
        } else if (action.type === "move" || action.type === "reorder") {
          parentId = action.destinationZone.split(":")[0];
        }
        if (parentId && !editableIds.has(parentId)) {
          return false;
        }
        return true;
      }

      return true;
    },
    [store]
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setSoftConfig(store.getState().softConfig);
      setSoftComponents(store.getState().softComponents);
    });
    return () => {
      unsubscribe();
    };
  }, [store]);

  useEffect(() => {
    const unsubscribe = store.subscribe((state, prevState) => {
      // FIX: Debounce visibility updates to prevent race conditions
      // Only update when state or editableComponentIds actually change
      if (
        prevState &&
        state.state === prevState.state &&
        state.editableComponentIds === prevState.editableComponentIds
      ) {
        return;
      }

      const doc = store.getState().getIframeDoc();
      if (!doc) return;

      // Apply edit visibility styling based on current state
      if (state.state === "building") {
        setEditVisibility(doc, { mode: "build", editableIds: state.editableComponentIds });
        return;
      }

      if (state.state === "remodeling") {
        setEditVisibility(doc, { mode: "remodel", editableIds: state.editableComponentIds });
        return;
      }

      // FIX: Always clear visibility when not in editing mode
      // This ensures grey-out styling is removed after complete/cancel/inspect
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        const freshDoc = store.getState().getIframeDoc();
        if (freshDoc) {
          clearEditVisibility(freshDoc);
        }
      });
    });

    return () => {
      unsubscribe();
    };
  }, [store]);

  return (
    <appStoreContext.Provider value={store}>
      {children(softConfig as Config, internalSoftComponents, storeSetIframeDoc, validateAction)}
    </appStoreContext.Provider>
  );
};
