"use client"
import { DefaultRootProps, PuckComponent, RootData, RootDataWithProps, WithChildren, WithPuckProps } from "@measured/puck";
import { RootProps } from ".";
import { createSoftConfigStore } from "@netlisian/softconfig/puck";

const useSoftConfig = createSoftConfigStore();

const renderConditionalPreview: PuckComponent<WithChildren<RootProps>> = ({ children }) => {
  const state = useSoftConfig((s) => s.state);

  // if (state === "building" || state === "remodeling") {
  //   return <>{state}</>;
  // } else 
  return <>{state}{children}</>;
}

export const rootRender: PuckComponent<WithChildren<RootProps>> = (props) => {
  if (props.puck.isEditing) {

    return renderConditionalPreview(props);
  }
  return <>{props.children}</>;
};

