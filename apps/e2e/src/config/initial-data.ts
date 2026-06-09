import { Data } from "@puckeditor/core";

export const initialData: Record<string, Partial<Data>> = {
  "/": {
    root: {
      props: {
        title: "Test Page",
      },
    },

    content: [
      {
        type: "container",
        props: {
          slotItem: [
            {
              type: "container",
              props: {
                slotItem: [],
                id: "container-b7269f50-db51-42b2-b525-4f7ce7a15cca",
                element: "img",
                attributes: [
                  {
                    key: "src",
                    valueType: "string",
                  },
                  {
                    key: "className",
                    valueType: "string",
                  },
                ],
                values: {
                  className: "aspect-video object-cover w-full",
                  src: "https://images.unsplash.com/photo-1750564042970-27123995da1b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwyfHx8ZW58MHx8fHx8",
                },
              },
            },
            {
              type: "text",
              props: {
                id: "text-49def143-b1f0-4932-8712-c1b94d340faa",
                text: "Hello world",
              },
            },
          ],
          element: "div",
          id: "container-fe4c6aa8-991c-4300-9c3f-739f00e1ec09",
          attributes: [
            {
              key: "className",
              valueType: "string",
            },
          ],
          values: {
            className: "flex flex-col gap-4 p-4",
          },
          _slotEnabled: false,
        },
      },
    ],
    zones: {},
  },
};
