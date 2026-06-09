import { ComponentConfig } from "@measured/puck";
import React from "react";

export type DeepFlatContainerProps = {
  text: string;
};

export const DeepFlatContainer: ComponentConfig<DeepFlatContainerProps> = {
  label: "Deep Flat Container",
  defaultProps: {
    text: "Deep normal text",
  },
  fields: {
    text: { type: "textarea", label: "Text" },
  },
  render: ({ text }) => {
    return (
      <div className="deep-1">
        <div className="deep-2">
          <div className="deep-3">
            <div className="deep-4">
              <div className="deep-5">
                <h1>{text}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
};
