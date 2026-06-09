import React from "react";
import { type SlotComponent } from "@measured/puck";

// Holds the already-transformed Puck slot render functions keyed by page ID.
// Using a Map instead of an array means only PageNodes whose slot actually
// changed will re-render — array reference changes on every Puck action
// previously caused all PageNodes to re-render unconditionally.
export const SlotsContext = React.createContext<Map<string, SlotComponent>>(new Map());
