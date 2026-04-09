import React from "react";

/**
 * Top-level error boundary. Catches render-time exceptions anywhere in the
 * tree and shows a friendly fallback with a reload button instead of a
 * blank white screen. Logs the error to the console (and PostHog if
 * available) for debugging.
 */
type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
    try {
      const ph = (window as unknown as { posthog?: { capture: (e: string, p: unknown) => void } }).posthog;
      ph?.capture?.("client_error", {
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      });
    } catch {
      // swallow — telemetry must never break the error UI
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: "white",
            padding: "32px",
            borderRadius: 12,
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, color: "#0f172a" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 20px", color: "#475569", fontSize: 14 }}>
            The page hit an unexpected error. Try reloading. If it keeps
            happening, contact your administrator.
          </p>
          {this.state.error?.message && (
            <pre
              style={{
                textAlign: "left",
                background: "#f1f5f9",
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                color: "#334155",
                overflow: "auto",
                maxHeight: 160,
                margin: "0 0 20px",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: "10px 20px",
                background: "#0f172a",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
            <button
              onClick={this.handleHome}
              style={{
                padding: "10px 20px",
                background: "#e2e8f0",
                color: "#0f172a",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
