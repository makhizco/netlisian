"use client";

import config from "@/src/config";
import {
  AppState,
  Config,
  Puck,
  PuckAction,
  Render,
  createUsePuck,
} from "@measured/puck";

const useCustomPuck = createUsePuck();
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
import { softConfigOverrides } from "@/src/puck/overrides/softconfig";
import { useDemoData } from "@/src/lib/use-demo-data";
import { toast } from "sonner";
import { Data } from "@measured/puck";

// Extend window interface
declare global {
  interface Window {
    puckDispatch: (action: any) => void;
    puckState: AppState;
    softConfigStore: any;
  }
}

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

// A helper component to expose puck state to window
const PuckExposer = () => {
  const appState = useCustomPuck(s => s.appState);
  const dispatch = useCustomPuck(s => s.dispatch);
  useEffect(() => {
    window.puckDispatch = dispatch;
    window.puckState = appState;
  }, [appState, dispatch]);
  return null;
};

const PuckInner = ({ softConfig, processorRef, data, resolvedData, styles, saveData, isEdit, storeRef }: PuckInnerProps) => {
  const store = useSoftConfigStore();

  useEffect(() => {
    if (storeRef) storeRef.current = store;
    window.softConfigStore = store;
  }, [store, storeRef]);

  const onAction = useCallback(
    (action: PuckAction, appState: AppState, previousState: AppState) => {
      const { state, validateAction, undoFn } = store.getState();

      const actionValidator = createActionCallback(validateAction, undoFn);

      if (state !== "ready") {
        actionValidator(action);
      } else {
        console.log("Puck Action:", action);
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
        console.log("Publishing", publishedData);
      }}
      overrides={{
        actionBar: ActionBar,
        headerActions: ({ children }) => (
          <>
            <HeaderActions>{children}</HeaderActions>
            <PuckExposer />
          </>
        ),
        drawerItem: DrawerItem,
        iframe: IframeOverride((processor) => {
          processorRef.current = processor;
        }),
      }}
    />
  );
};

const LocalHeaderActions = ({ children }: { children?: React.ReactNode }) => {
  const hasPuck = useCustomPuck((s) => !!s);
  console.log("PUCK CONTEXT IN LOCAL HEADER ACTIONS:", hasPuck ? "FOUND" : "NOT FOUND");
  return <div>{children}</div>;
};

export default function PuckEditor({
  path,
  isEdit,
}: {
  path: string;
  isEdit: boolean;
}) {
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
    // Handling soft actions
  };

  return (
    <div className="text-foreground bg-background">
      <SoftConfigProvider hardConfig={config as any} softComponents={softComponents} overrides={softConfigOverrides} onActions={handleSoftActions}>
        {(softConfig: any) => (
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
