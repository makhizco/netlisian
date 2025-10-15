import { leafElements } from "../utilities/leaf-elements";

export const isLeafElement = (element: string) => {
  return leafElements.includes(element as typeof leafElements[number]);
};