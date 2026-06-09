"use client";
import { VersionedSoftComponent } from "./SoftComponent";

export type ActionEventPayload =
  | {
      type: "build";
      payload: {
        id: string;
      };
    }
  | {
      type: "remodel";
      payload: {
        id: string;
        version?: string;
        softComponent?: VersionedSoftComponent["versions"][string];
      };
    }
  | {
      type: "complete";
      payload: {
        id: string;
        version: string;
        componentData: Record<string, any>;
        softComponent: VersionedSoftComponent["versions"][string];
      };
    }
  | {
      type: "cancel";
      payload: Record<string, never>;
    }
  | {
      type: "demolish";
      payload: {
        id: string;
      };
    }
  | {
      type: "setDefaultVersion";
      payload: {
        id: string;
        version: string;
      };
    }
  | {
      type: "deleteVersion";
      payload: {
        id: string;
        version: string;
        migrateToVersion?: string;
      };
    }
  | {
      type: "inspect";
      payload: {
        id: string;
        version?: string;
        softComponent?: VersionedSoftComponent["versions"][string];
      };
    }
  | {
      type: "decompose";
      payload: {
        id: string;
      };
    }
  | {
      type: "publish";
      payload: {
        id: string;
        version: string;
      };
    };

export type OnActionsCallback = (event: ActionEventPayload) => void | Promise<void>;
