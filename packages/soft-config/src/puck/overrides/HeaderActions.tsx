"use client";
import { Button, Data, Overrides, createUsePuck } from "@measured/puck";
const useCustomPuck = createUsePuck();
import { useComplete } from "../actions/useComplete";
import { useCancel } from "../actions/useCancel";
import { useSoftConfig } from "../context/useStore";
import { inspect } from "util";
import { notify } from "../lib/notify";



export const HeaderActions: Overrides["headerActions"] = ({ children }) => {
  const { handleComplete } = useComplete();
  const { handleCancel, canCancel } = useCancel();
  const dispatch = useCustomPuck((s) => s.dispatch);
  const appState = useCustomPuck((s) => s.appState);
  const selectedItemSelector = appState.ui.itemSelector;
  const inspect = useSoftConfig((s) => s.builder.inspect);

  return (
    <>
      {canCancel ? (
        <>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const completedComponent = handleComplete();
              if (completedComponent) {
                try {
                  inspect(completedComponent.id, dispatch, selectedItemSelector);
                } catch (error) {
                  notify.error(
                    "Failed to inspect after completion: " +
                      (error instanceof Error ? error.message : String(error)),
                  );
                }
              }
            }}
          >
            Complete
          </Button>
        </>
      ) : (
        children
      )}
    </>
  );
};
