import { leafElements } from "./leaf-elements";

export const isLeafElement = (element: string) => {
  return leafElements.includes(element as typeof leafElements[number]);
};