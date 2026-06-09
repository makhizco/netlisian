"use client";
import React from 'react';
import LiveEditor from '../LiveEditor';

const simpleConfig = {
  components: {
    Hero: {
      fields: {
        title: { type: "text" },
        variant: { 
            type: "select", 
            options: [
                { label: "Primary", value: "primary" },
                { label: "Secondary", value: "secondary" }
            ] 
        }
      },
      render: ({ title, variant }: any) => (
        <div style={{ 
            padding: 64, 
            background: variant === 'secondary' ? '#f3f4f6' : '#111827', 
            color: variant === 'secondary' ? '#000' : '#fff' 
        }}>
          <h1>{title || "Hello World"}</h1>
        </div>
      )
    }
  }
} as any;

const initialData = {
  content: [
    {
      type: "Hero",
      props: { title: "Edit me!", variant: "primary" }
    }
  ],
  root: { props: { title: "My Page" } }
} as any;

export default function HomeDemo() {
  return <LiveEditor config={simpleConfig} initialData={initialData} />
}
