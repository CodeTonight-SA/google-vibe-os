import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-fallback">
                    <AlertTriangle size={40} strokeWidth={1.5} />
                    <h2>Something went wrong</h2>
                    <p>{this.state.error?.message || 'An unexpected error occurred'}</p>
                    <div className="error-boundary-actions">
                        <button onClick={this.handleReset} className="error-boundary-btn">
                            <RotateCcw size={16} />
                            Try again
                        </button>
                        <button onClick={this.handleReload} className="error-boundary-btn error-boundary-btn-secondary">
                            <RefreshCw size={16} />
                            Reload app
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
