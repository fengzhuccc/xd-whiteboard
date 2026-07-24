import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// 过滤 Radix UI 自定义状态伪类 deprecation 警告，保持控制台干净。
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args.join(" ");
  if (
    message.includes("Custom state pseudo classes have been changed") &&
    message.includes("radix-")
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
