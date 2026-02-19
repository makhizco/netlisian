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
      };
    }
  | {
      type: "complete";
      payload: {
        id: string;
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
      type: "inspect";
      payload: {
        id: string;
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
