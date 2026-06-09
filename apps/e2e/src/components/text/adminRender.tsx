"use client";

import { createUsePuck, PuckComponent } from "@puckeditor/core";
import { TextProps } from "./Text";

const useCustomPuck = createUsePuck();
import { GripVertical } from "lucide-react";

export const adminRender: PuckComponent<TextProps> = ({
  text,
  puck: { dragRef },
  id,
}) => {
  const selectedItem = useCustomPuck((s) => s.selectedItem);

  const isSelected = selectedItem?.props?.id === id;

  return (
    <span ref={dragRef}>
      {text}

      {isSelected && (
        <>
          <span className="w-[1em] h-2 inline-block" />
          <GripVertical className="absolute bottom-0 right-0 size-[1.25em]" />
        </>
      )}
    </span>
  );
};
