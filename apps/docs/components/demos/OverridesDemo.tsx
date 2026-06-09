"use client";
import React from 'react';
import LiveEditor from '../LiveEditor';

const buttonConfig = {
  components: {
    Button: {
      fields: {
        label: { type: "text" },
        variant: {
            type: "radio",
            options: [
                { label: "Blue", value: "blue" },
                { label: "Red", value: "red" }
            ]
        }
      },
      render: ({ label, variant }: any) => (
        <button style={{
            padding: "10px 20px",
            background: variant === 'red' ? 'red' : 'blue',
            color: 'white',
            border: 'none',
            borderRadius: 4
        }}>
          {label || "Click Me"}
        </button>
      )
    }
  }
} as any;

const buttonData = {
  content: [
    { type: "Button", props: { label: "Purchase", variant: "blue" } }
  ],
  root: { props: { title: "Demo" } }
} as any;

export default function OverridesDemo() {
  return <LiveEditor config={buttonConfig} initialData={buttonData} />
}
