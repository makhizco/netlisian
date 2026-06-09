import { ComponentConfig } from "@measured/puck";
import React from "react";
import { TextProps } from "./Text";
import { adminRender } from "./adminRender";

export const Text: ComponentConfig<TextProps> = {
  label: "Text",
  defaultProps: {
    text: "Hello world",
  },
  inline: true,
  fields: {
    text: {
      type: "textarea",
      label: "Text",
      placeholder: "Enter text",
      contentEditable: true,
    },
  },
  render: ({ text, puck, id }) =>
    puck.isEditing ? (
      adminRender({ text, puck, id})
    ) : (
      <React.Fragment>{text}</React.Fragment>
    ),
};
