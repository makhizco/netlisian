import React from "react";
import { ActionBar } from "@measured/puck";
import { useBuild } from "../actions/useBuild";
import { useRemodel } from "../actions/useRemodel";
import { useDecompose } from "../actions/useDecompose";
import { useSoftConfig } from "../context/useStore";
import { Combine, ComponentIcon, EditIcon } from "lucide-react";
import getClassNameFactory from "../lib/get-class-name-factory";
import styles from "./ActionBar.module.css";

const getClassName = getClassNameFactory("ActionBar", styles);

export const ActionBarOverride = (props: {
  label?: string;
  parentAction?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  const { handleBuild, canBuild } = useBuild();
  const { handleRemodel, canRemodel } = useRemodel();
  const { handleDecompose, canDecompose } = useDecompose();
  const softComponents = useSoftConfig((s) => s.softComponents);
  const status = useSoftConfig((s) => s.state);

  const isSoftComponent = Object.keys(softComponents || {}).includes(props.label!);

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
                  onClick={() => handleRemodel(props.label)}
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
              <ActionBar.Action onClick={handleBuild} label="Build Soft Component">
                <ComponentIcon size={16} />
              </ActionBar.Action>
            )
          ) : null}

          {props.children}
        </ActionBar.Group>
      </ActionBar>
    </div>
  );
};
