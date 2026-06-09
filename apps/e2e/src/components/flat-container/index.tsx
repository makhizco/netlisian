import { ComponentConfig } from "@puckeditor/core";
import React from "react";

export type FlatContainerProps = {
  text: string;
};

export const FlatContainer: ComponentConfig<FlatContainerProps> = {
  label: "Flat Container",
  defaultProps: {
    text: "Normal text",
  },
  fields: {
    text: { type: "textarea", label: "Text" },
  },
  render: ({ text }) => {
    return (
      <div className="flat-container">
        <h1>{text}</h1>
      </div>
    );
  },
};
