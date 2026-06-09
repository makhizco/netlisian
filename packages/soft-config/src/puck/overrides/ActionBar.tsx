"use client";
import React, { useMemo } from "react";
import { ActionBar, createUsePuck } from "@measured/puck";
const useCustomPuck = createUsePuck();
import { useBuild } from "../actions/useBuild";
import { useRemodel } from "../actions/useRemodel";
import { useDecompose } from "../actions/useDecompose";
import { useSoftConfig } from "../context/useStore";
import { Combine, ComponentIcon, EditIcon } from "lucide-react";
import getClassNameFactory from "../lib/get-class-name-factory";
import styles from "./ActionBar.module.css";
import { shallow } from "zustand/shallow";
import { componentLabelFromName, componentNameFromLabel } from "../lib/component-key";


const getClassName = getClassNameFactory("ActionBar", styles);


export const ActionBarOverride = (props: {
  label?: string;
  parentAction?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  const { handleBuild } = useBuild(props.label ? props.label + " Soft Component" : "New Soft Component");
  const { handleRemodel } = useRemodel();
  const { handleDecompose } = useDecompose();
  const overrides = useSoftConfig((s) => s.overrides);
  const softComponents = useSoftConfig((s) => s.softComponents, shallow);
  const editableIds = useSoftConfig((s) => s.editableComponentIds);
  const selectedItem = useCustomPuck((s) => s.selectedItem);
  const appState = useCustomPuck((s) => s.appState);
  const rootProps = appState.data.root.props;
  const status = useSoftConfig((s) => s.state);
  const itemSelector = appState.ui.itemSelector;
  const softKeys = Object.keys(softComponents);

  const key = useMemo(() => {
    // Prefer the selected component type when available to avoid label->key drift.
    const selectedType = selectedItem?.type;
    if (selectedType && softKeys.includes(selectedType)) {
      return selectedType;
    }

    return componentNameFromLabel(props.label || "", overrides, {
      ...(rootProps || {}),
      existingKeys: softKeys,
      state: status,
    });
  }, [
    props.label,
    overrides,
    selectedItem?.type,
    softKeys,
    status,
    rootProps,
  ]);

  const isSoftComponent = softKeys.includes(key!);
  const selectedId = selectedItem?.props?.id;
  const parentId = itemSelector?.zone?.split(":")[0];
  const isEditable = Boolean(selectedId && (editableIds.has(selectedId) || (parentId && editableIds.has(parentId))));

  const label = useMemo(() => {
    if (isSoftComponent) {
      return softComponents[key!]?.name || componentLabelFromName(key!, overrides);
    }
    return props.label || "";
  }, [isSoftComponent, key, props.label, overrides, softComponents]);

  return (
    <div className={getClassName()}>
      <ActionBar>
        <ActionBar.Group>
          {props.parentAction}
          <ActionBar.Label label={label} />
        </ActionBar.Group>


        <ActionBar.Group>
          {status === "ready" ? (
            isSoftComponent ? (
              <>
                <ActionBar.Action
                  onClick={() => handleRemodel(key!)}
                  label="Remodel Soft Component"
                >
                  <EditIcon size={16} />
                </ActionBar.Action>
                <ActionBar.Action
                  onClick={() => handleDecompose()}
                  label="Decompose Soft Component"
                >
                  <Combine size={16} />
                </ActionBar.Action>
              </>
            ) : (
              <ActionBar.Action
                onClick={handleBuild}
                label="Build Soft Component"
              >
                <ComponentIcon size={16} />
              </ActionBar.Action>
            )
          ) : null}

          {status !== "ready" && !isEditable ? null : (props.children)}
        </ActionBar.Group>
      </ActionBar>
    </div>
  );
};
