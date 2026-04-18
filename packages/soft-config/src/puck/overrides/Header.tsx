import React from "react";
import { Button, Data, createUsePuck } from "@measured/puck";
import { useComplete } from "../actions/useComplete";
import { useCancel } from "../actions/useCancel";
import { useInspect } from "../actions/useInspect";
import getClassNameFactory from "../lib/get-class-name-factory";
import styles from "./Header.module.css";
import { SoftComponents } from "../types/SoftComponent";
import { usePublish } from "../actions/usePublish";

const getClassName = getClassNameFactory("Header", styles);
const usePuck = createUsePuck();

export const Header = ({
  onPublish,
  children,
}: {
  onPublish?: (data: Data, softComponents: SoftComponents) => void;
  children: React.ReactNode;
}) => {
  const { handleComplete, newComponent, setNewComponent } =
    useComplete();
  const { handleCancel, canCancel } = useCancel();
  const { handlePublish } = usePublish();

  useInspect(newComponent);

  return (
    <div className={getClassName()}>
      {canCancel ? (
        <>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const completedComponent = handleComplete();
              if (completedComponent) {
                setNewComponent(completedComponent);
              }
            }}
          >
            Complete
          </Button>
        </>
      ) : children ? (
        children
      ) : (
        <Button
          variant="primary"
          onClick={() => {
            if (onPublish) {
              handlePublish(onPublish);
            }
          }}
        >
          Publish
        </Button>
      )}
    </div>
  );
};
