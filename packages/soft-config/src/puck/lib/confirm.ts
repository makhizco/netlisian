// Confirmation dialog handler
type ConfirmHandler = (message: string) => Promise<boolean> | boolean;

let confirmHandler: ConfirmHandler = (message: string) => {
  return window.confirm(message);
};

/**
 * Set a custom confirmation handler
 * @param handler - Function that shows confirmation dialog and returns boolean or Promise<boolean>
 */
export const setConfirmHandler = (handler: ConfirmHandler) => {
  confirmHandler = handler;
};

/**
 * Show a confirmation dialog
 * @param message - The confirmation message
 * @returns Promise<boolean> - true if confirmed, false otherwise
 */
export const confirm = async (message: string): Promise<boolean> => {
  try {
    const result = confirmHandler(message);
    return result instanceof Promise ? await result : result;
  } catch (error) {
    console.error("Confirm handler error:", error);
    return false;
  }
};
