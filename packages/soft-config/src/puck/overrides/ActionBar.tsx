import React, { useMemo } from "react";
import { ActionBar, createUsePuck } from "@measured/puck";
import { useBuild } from "../actions/useBuild";
import { useRemodel } from "../actions/useRemodel";
import { useDecompose } from "../actions/useDecompose";
import { useSoftConfig } from "../context/useStore";
import { Combine, ComponentIcon, EditIcon } from "lucide-react";
import getClassNameFactory from "../lib/get-class-name-factory";
import styles from "./ActionBar.module.css";
import { shallow } from "zustand/shallow";
import { createComponentKeyFromName } from "../lib/component-key";

const getClassName = getClassNameFactory("ActionBar", styles);
const usePuck = createUsePuck();

export const ActionBarOverride = (props: {
  label?: string;
  parentAction?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  const { handleBuild } = useBuild("Custom Name");
  const { handleRemodel } = useRemodel();
  const { handleDecompose } = useDecompose();
  const overrides = useSoftConfig((s) => s.overrides);
  const softComponents = useSoftConfig((s) => s.softComponents, shallow);
  const editableIds = useSoftConfig((s) => s.editableComponentIds);
  const selectedItem = usePuck((s) => s.selectedItem);
  const status = useSoftConfig((s) => s.state);
  const softKeys = Object.keys(softComponents);

  const key = useMemo(() => createComponentKeyFromName(props.label || "", overrides, {
    existingKeys: softKeys,
    state: status
  }), [
    props.label,
    overrides,
    softKeys,
    status
  ]);

  const isSoftComponent = softKeys.includes(key!);
  const selectedId = selectedItem?.props?.id;
  const isEditable = Boolean(selectedId && editableIds.has(selectedId));

  return (
    <div className={getClassName()}>
      <ActionBar>
        <ActionBar.Group>
          {props.parentAction}
          <ActionBar.Label label={props.label!} />
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
