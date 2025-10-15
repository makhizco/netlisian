"use client";

import { initTailwind } from "@netlisian/tailwind";
import React, { useState, useEffect } from "react";
import {
  SoftConfigProvider,
  Header,
  ActionBar,
  ComponentItem,
  setNotificationHandler,
  setConfirmHandler,
} from "@netlisian/softconfig/puck";
// @ts-ignore - allow side-effect CSS import without type declarations
import "@measured/puck/puck.css";
import { config } from "../../config";

import { Data, Puck, Render } from "@measured/puck";
import { useDemoData } from "../../lib/use-demo-data";
import { toast } from "sonner";
import { notFound } from "next/navigation";

export default function PuckEditor({
  path,
  isEdit,
}: {
  path: string;
  isEdit: boolean;
}) {
  const {
    data,
    resolvedData,
    softComponents: initialSoftComponents,
    saveData,
  } = useDemoData({
    path,
    isEdit,
    // metadata,
  });

  // Set up custom notification handler using sonner
  useEffect(() => {
    setNotificationHandler((message, type) => {
      if (type === "error") {
        toast.error(message);
      } else {
        toast.success(message);
      }
    });

    // Set up custom confirmation handler
    // You can use any custom dialog library here
    setConfirmHandler(async (message) => {
      // Example: Use native browser confirm (default)
      return window.confirm(message);

      // Or use a custom async dialog:
      // return new Promise((resolve) => {
      //   customDialog.show({
      //     message,
      //     onConfirm: () => resolve(true),
      //     onCancel: () => resolve(false),
      //   });
      // });
    });
  }, []);

  if (!isEdit) {
    if (!data) {
      return notFound();
    }

    if (data && !resolvedData) {
      return (
        <div
          role="status"
          aria-live="polite"
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
            color: "#111",
            padding: 16,
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 50 50"
            aria-hidden="true"
            style={{ animation: "nl-spin 900ms linear infinite" }}
          >
            <circle cx="25" cy="25" r="20" fill="none" stroke="#e6e6e6" strokeWidth="4" />
            <path
              d="M45 25a20 20 0 0 1-20 20"
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>

          <div style={{ marginTop: 8, fontSize: 16 }}>Loading content…</div>

          {/* Local keyframes so we don't rely on external CSS */}
          <style>{`@keyframes nl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    initTailwind(document).catch(console.error);
    return (
      <>

        <Render data={resolvedData!} config={config} />
      </>
    );
  }

  return (
    <SoftConfigProvider
      hardConfig={config}
      softComponents={initialSoftComponents || {}}
    >
      {(softConfig, softComponents) => (
        <Puck
          data={data}
          config={softConfig}
          overrides={{
            iframe: (props) => {
              const [twInit, setTwInit] = useState(false);

              if (props.document) {
                props.document.body.style.color = "black";
                props.document.body.style.backgroundColor = "white";
                if (!twInit) {
                  setTimeout(
                    () => initTailwind(props.document).catch(console.error),
                    500
                  );
                  // initTailwind(props.document).catch(console.error);
                  setTwInit(true);
                }
              }

              return props.children as any;
            },

            headerActions: Header,
            actionBar: ActionBar,
            drawerItem: ComponentItem,
          }}
          iframe={{
            waitForStyles: true,
          }}
          onPublish={(data) => {
            // Persist page data and current soft components to local storage
            try {
              saveData?.(data, softComponents || {});
            } catch (err) {
              console.error("Failed to save published data", err);
            }
          }}
        />
      )}
    </SoftConfigProvider>
  );
}
