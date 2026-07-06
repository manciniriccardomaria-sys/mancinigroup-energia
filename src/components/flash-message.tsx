type FlashMessageProps = {
  type?: "success" | "error";
  message?: string;
};

export function FlashMessage({ type, message }: FlashMessageProps) {
  if (!message) {
    return null;
  }

  return <div className={`alert ${type === "error" ? "error" : "success"}`}>{message}</div>;
}
