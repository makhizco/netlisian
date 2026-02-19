import { ComponentConfig } from "@measured/puck";

export const ConditionalView: ComponentConfig = {
  fields: {
    hidden: {
      type: "radio",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    children: { type: "slot" },
  },
  defaultProps: {
    hidden: false,
  },
  render: ({ hidden, children: Children }) =>
    hidden ? <></> : (
      <>
        <Children />
      </>
    ),
};
