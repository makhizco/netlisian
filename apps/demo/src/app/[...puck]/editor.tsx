"use client";

import config from "@/src/config";
import { AppState, Config, Puck, PuckAction } from "@puckeditor/core";
import {
  ActionBar,
  createActionCallback,
  DrawerItem,
  HeaderActions,
  SoftConfigProvider,
  useSoftConfigStore,
} from "@netlisian/softconfig/puck";
import "@puckeditor/core/puck.css";
import "@netlisian/softconfig/puck/index.css";
import { MutableRefObject, useCallback, useRef, useEffect } from "react";
import type { TailwindProcessor } from "@netlisian/tailwind";
import { IframeOverride } from "./iframe";
import { softConfigOverrides } from "../../puck/overrides/softconfig";
import { toast } from "sonner";
import { Data } from "@puckeditor/core";
import Image from "next/image";

interface PuckInnerProps {
  softConfig: Config;
  processorRef: MutableRefObject<TailwindProcessor | null>;
  data: Partial<Data>;
  saveData: any;
  storeRef?: React.MutableRefObject<any>;
}

export const PuckInner = ({
  softConfig,
  processorRef,
  data,
  saveData,
  storeRef,
}: PuckInnerProps) => {
  const store = useSoftConfigStore();

  useEffect(() => {
    if (storeRef) storeRef.current = store;
  }, [store, storeRef]);

  const onAction = useCallback(
    (action: PuckAction, appState: AppState, previousState: AppState) => {
      const { state, validateAction, undoFn } = store.getState();

      // Create the action guard using softconfig's validation and undo functions
      // Perform validation and undo if necessary
      const actionValidator = createActionCallback(validateAction, undoFn);

      if (state !== "ready") {
        actionValidator(action);
      } else {
        console.log(101, action);
      }
    },
    [store],
  );

  return (
    <Puck
      config={softConfig}
      data={data as Data}
      onAction={onAction}
      onPublish={async (publishedData) => {
        const generatedCSS = processorRef.current?.getCss() || "";
        const softComponents = store.getState().softComponents;
        try {
          await saveData?.(
            publishedData,
            softComponents || {},
            generatedCSS,
            softConfig,
          );
          toast.success("Page published with styles!");
        } catch (err) {
          console.error("Failed to save published data", err);
          toast.error("Failed to publish page");
        }
      }}
      overrides={{
        actionBar: ActionBar,
        headerActions: HeaderActions,
        drawerItem: DrawerItem,
        iframe: IframeOverride((processor) => {
          processorRef.current = processor;
        }),
      }}
    ></Puck>
  );
};

export default function PuckEditor({
  saveSoftComponents,
  softComponents,
  data,
  saveData,
}: {
  saveSoftComponents: (softComponents: any) => void;
  softComponents: any;
  data: Partial<Data>;
  saveData: any;
}) {
  // Refs
  const processorRef = useRef<TailwindProcessor | null>(null);
  const storeRef = useRef<any>(null);

  const handleSoftActions = async (event: any) => {
    const eventType = event.type;

    const doSave = () => {
      setTimeout(() => {
        if (storeRef.current) {
          const storeState = storeRef.current.getState();
          if (storeState && storeState.softComponents) {
            saveSoftComponents(storeState.softComponents);
          }
        }
      }, 0);
    };

    if (eventType === "demolish") {
      toast.success(`Soft component deleted: ${event.payload?.id}`);
      doSave();
    } else if (eventType === "deleteVersion") {
      toast.success(
        `Deleted ${event.payload?.id || "component"}@${event.payload?.version || "unknown"}`,
      );
      doSave();
    } else if (eventType === "complete") {
      toast.success(
        `Soft component ready: ${event.payload?.id}@${event.payload?.version || "unknown"}`,
      );
      doSave();
    } else if (eventType === "inspect") {
      toast.message(
        `Inspecting soft component: ${event.payload?.id}${event.payload?.version ? "@" + event.payload.version : ""}`,
      );
    }
  };

  return (
    <div className="text-foreground bg-background">
      <Image
        width={36}
        height={36}
        src="/logo-icon.png"
        alt="Site Logo"
        loading="eager"
        className="z-10 absolute top-4 left-4"
      />
      <SoftConfigProvider
        hardConfig={config}
        softComponents={softComponents}
        overrides={softConfigOverrides}
        onActions={handleSoftActions}
      >
        {(softConfig) => (
          <PuckInner
            storeRef={storeRef}
            softConfig={softConfig}
            processorRef={processorRef}
            data={data}
            saveData={saveData}
          />
        )}
      </SoftConfigProvider>
    </div>
  );
}
