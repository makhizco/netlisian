"use client";

import config from "@/src/config";
import {
  AppState,
  Config,
  Puck,
  PuckAction,
  Render,
} from "@measured/puck";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  ActionBar,
  createActionCallback,
  DrawerItem,
  HeaderActions,
  SoftConfigProvider,
  useSoftConfigStore,
} from "@netlisian/softconfig/puck";
import "@measured/puck/puck.css";
import "@netlisian/softconfig/puck/index.css";
import { MutableRefObject, useCallback, useRef, useEffect } from "react";
import type { TailwindProcessor } from "@netlisian/tailwind";
import { IframeOverride } from "./iframe";
import { softConfigOverrides } from "../../puck/overrides/softconfig";
import { useDemoData } from "../../lib/use-demo-data";
import { toast } from "sonner";
import { Data } from "@measured/puck";

interface PuckInnerProps {
  softConfig: Config;
  processorRef: MutableRefObject<TailwindProcessor | null>;
  data: Partial<Data>;
  resolvedData: Partial<Data> | undefined;
  styles: string | undefined;
  saveData: any;
  isEdit: boolean;
  storeRef?: React.MutableRefObject<any>;
}

const PuckInner = ({ softConfig, processorRef, data, resolvedData, styles, saveData, isEdit, storeRef }: PuckInnerProps) => {
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

  if (!isEdit) {
    return (
      <>
        {styles && (
          <style
            id="static-tailwind-styles"
            dangerouslySetInnerHTML={{ __html: styles }}
          />
        )}
        <Render data={resolvedData!} config={softConfig as any} />
      </>
    );
  }

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
    >
    </Puck>
  );
};

export default function PuckEditor({
  path,
  isEdit,
}: {
  path: string;
  isEdit: boolean;
}) {
  // Refs
  const processorRef = useRef<TailwindProcessor | null>(null);
  const storeRef = useRef<any>(null);

  const {
    data,
    resolvedData,
    styles,
    softComponents,
    saveData,
    saveSoftComponents,
  } = useDemoData({
    path,
    isEdit,
  });

  if (!isEdit && !data) {
    return notFound();
  }

  if (!isEdit && data && !resolvedData) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[90vh] flex-col items-center justify-center gap-3 p-4 text-slate-900"
      >
        <Loader2 className="animate-spin" size={24} />
        <p className="text-sm">Preparing your page...</p>
      </div>
    );
  }

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
      toast.success(`Deleted ${event.payload?.id || "component"}@${event.payload?.version || "unknown"}`);
      doSave();
    } else if (eventType === "complete") {
      toast.success(`Soft component ready: ${event.payload?.id}@${event.payload?.version || "unknown"}`);
      doSave();
    } else if (eventType === "inspect") {
      toast.message(`Inspecting soft component: ${event.payload?.id}${event.payload?.version ? "@" + event.payload.version : ""}`);
    }
  };

  return (
    <div className="text-foreground bg-background">
      <SoftConfigProvider hardConfig={config} softComponents={softComponents} overrides={softConfigOverrides} onActions={handleSoftActions}>
        {(softConfig) => (
          <PuckInner 
            storeRef={storeRef}
            softConfig={softConfig} 
            processorRef={processorRef} 
            data={data}
            resolvedData={resolvedData}
            styles={styles}
            saveData={saveData}
            isEdit={isEdit}
          />
        )}
      </SoftConfigProvider>
    </div>
  );
}
