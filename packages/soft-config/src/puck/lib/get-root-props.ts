import { AppState, Field } from "@measured/puck";

export const getRootProps = (
  appState: AppState
): {
  _fields?: { name: string; type: Field["type"] }[];
  _fieldSettings?: {
    [key: string]: any;
  };
} =>
  appState.data.root.props as {
    _fields?: { name: string; type: Field["type"] }[];
  };
