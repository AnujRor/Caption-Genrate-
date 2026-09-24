import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onReset: () => void;
}

// Last line of defence: an unexpected render error shows a recovery screen instead of a blank page.
export default class ErrorBoundary extends React.Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unexpected UI error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-full flex items-center justify-center p-6 bg-aurora">
        <div className="panel max-w-sm w-full p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-rose-500/15 text-rose-300 flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <h2 className="font-semibold mb-1">Something went wrong</h2>
          <p className="text-sm text-zinc-400 mb-5">Your projects are saved. Go back and open it again.</p>
          <button onClick={this.reset} className="btn-primary px-4 py-2.5 text-sm w-full">
            <RotateCcw size={15} /> Back to projects
          </button>
        </div>
      </div>
    );
  }
}
