// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.errorMessage.includes("permissions") || this.state.errorMessage.includes("Missing or insufficient permissions") || this.state.errorMessage.includes("permission-denied")) {
         return (
          <div className="p-8 max-w-lg mx-auto mt-12 bg-white border border-[#EFE8E2] rounded-2xl shadow-sm text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 flex items-center justify-center rounded-xl mx-auto mb-4">
              <ShieldAlert size={24} />
            </div>
            <h2 className="text-lg font-bold text-[#3C3530] mb-2">Insufficient Permissions</h2>
            <p className="text-sm text-[#7A726C] mb-6">
              You do not have the required permissions to view this data. This may happen if your session expired or your account role has changed.
            </p>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-[#5A5049] text-white rounded-xl text-sm font-bold hover:bg-[#3C3530] transition-colors"
            >
              Sign Out & Reload
            </button>
          </div>
        );
      }

      return (
        <div className="p-8 max-w-lg mx-auto mt-12 bg-white border border-[#EFE8E2] rounded-2xl shadow-sm text-center">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 flex items-center justify-center rounded-xl mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-lg font-bold text-[#3C3530] mb-2">Something went wrong</h2>
          <p className="text-sm text-[#7A726C] mb-6 whitespace-pre-wrap">
            {this.state.errorMessage || "An unexpected error occurred in the application."}
          </p>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-6 py-2.5 bg-[#5A5049] text-white rounded-xl text-sm font-bold hover:bg-[#3C3530] transition-colors"
          >
            Clear Session & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
