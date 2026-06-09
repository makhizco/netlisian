// Customizable error/success handler
type NotificationHandler = (message: string, type: "error" | "success") => void;

let customHandler: NotificationHandler | null = null;

// Default handler using native alert (non-blocking alternative would be console)
const defaultHandler: NotificationHandler = (message, type) => {
  if (type === "error") {
    alert(`[Error] ${message}`);
  } else {
    console.log(`[Success] ${message}`);
  }
};

export const setNotificationHandler = (handler: NotificationHandler) => {
  customHandler = handler;
};

export const notify = {
  error: (message: string) => {
    const handler = customHandler || defaultHandler;
    handler(message, "error");
  },
  success: (message: string) => {
    const handler = customHandler || defaultHandler;
    handler(message, "success");
  },
};
