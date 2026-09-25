import React from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { isStaleAssetError, reloadOnce } from '../lib/selfHeal';

interface Props {
  children: React.ReactNode;
  onReset: () => void;
}

interface State {
  error: Error | null;
  recovering: string | null;
}

const CRASH_WINDOW_MS = 20_000;

// Last line of defence. Instead of a blank page, it repairs itself in escalating steps:
// 1) re-render the same screen, 2) go back to the project list, 3) reload the page once.
// Only if all of that keeps failing does it ask the user to act.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, recovering: null };
  private crashes: number[] = [];
  private timer: number | undefined;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unexpected UI error:', error, info.componentStack);

    if (isStaleAssetError(error) && reloadOnce()) {
      this.setState({ recovering: 'Updating to the latest version…' });
      return;
    }

    const now = Date.now();
    this.crashes = [...this.crashes.filter((t) => now - t < CRASH_WINDOW_MS), now];
    const step = this.crashes.length;

    if (step === 1) {
      this.scheduleRecovery('Fixing automatically…', () => this.setState({ error: null, recovering: null }));
    } else if (step === 2) {
      this.scheduleRecovery('Returning to your projects…', this.reset);
    } else if (step === 3 && reloadOnce()) {
      this.setState({ recovering: 'Restarting the app…' });
    } else {
      this.setState({ recovering: null });
    }
  }

  componentWillUnmount() {
    window.clearTimeout(this.timer);
  }

  private scheduleRecovery(message: string, action: () => void) {
    this.setState({ recovering: message });
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(action, 900);
  }

  reset = () => {
    window.clearTimeout(this.timer);
    this.setState({ error: null, recovering: null });
    this.props.onReset();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { recovering } = this.state;
    return (
      <div className="min-h-full flex items-center justify-center p-6 bg-aurora">
        <div className="panel max-w-sm w-full p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-rose-500/15 text-rose-300 flex items-center justify-center">
            {recovering ? <Loader2 size={22} className="animate-spin" /> : <AlertTriangle size={22} />}
          </div>
          <h2 className="font-semibold mb-1">{recovering || 'Something went wrong'}</h2>
          <p className="text-sm text-zinc-400 mb-5">
            {recovering ? 'Your projects are safe. This only takes a moment.' : 'Your projects are saved. Go back and open it again, or reload the page.'}
          </p>
          {!recovering && (
            <div className="flex flex-col gap-2">
              <button onClick={this.reset} className="btn-primary px-4 py-2.5 text-sm w-full">
                <RotateCcw size={15} /> Back to projects
              </button>
              <button onClick={() => window.location.reload()} className="btn-ghost px-4 py-2.5 text-sm w-full">
                Reload page
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
