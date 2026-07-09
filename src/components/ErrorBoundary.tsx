import React from "react";

interface State { error: Error | null }

/**
 * App-wide error boundary. If any component (incl. a lazily-loaded tab) throws
 * during render, we show a friendly recovery screen instead of a blank page.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface in the console for diagnostics (and any attached error tracker)
    console.error("UI error boundary:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#fbfbfb] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-[16px] border border-black/[0.07] shadow-card p-7 text-center">
          <div className="w-12 h-12 rounded-[12px] bg-[#fdeaea] text-[#c0392b] flex items-center justify-center mx-auto mb-4 text-[22px]">!</div>
          <h1 className="text-[17px] font-semibold text-[#111111]">Algo salió mal</h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5 leading-relaxed">
            Ocurrió un error inesperado en la interfaz. Tus datos están a salvo — probá recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full h-10 rounded-[10px] bg-[#111111] hover:bg-[#232323] text-white text-[13.5px] font-medium transition-colors cursor-pointer"
          >
            Recargar
          </button>
          {(import.meta as any).env?.DEV && (
            <pre className="mt-4 text-left text-[10px] text-[#9ca3af] bg-[#f4f4f5] rounded-lg p-2 overflow-auto max-h-32 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
