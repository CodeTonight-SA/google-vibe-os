import { useState, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

// ============================================================
// useToast hook - manages toast state
// ============================================================
let toastIdCounter = 0;

export function useToast() {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef({});

    const removeToast = useCallback((id) => {
        if (timersRef.current[id]) {
            clearTimeout(timersRef.current[id]);
            delete timersRef.current[id];
        }
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'error', duration = 5000) => {
        const id = ++toastIdCounter;
        const toast = { id, message, type };
        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            timersRef.current[id] = setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, [removeToast]);

    return { toasts, addToast, removeToast };
}

// ============================================================
// ToastContainer component - renders toast stack
// ============================================================
const ICON_MAP = {
    error: AlertCircle,
    success: CheckCircle,
    info: Info
};

export function ToastContainer({ toasts, onDismiss }) {
    if (!toasts.length) return null;

    return (
        <div className="toast-container">
            {toasts.map(toast => {
                const Icon = ICON_MAP[toast.type] || Info;
                return (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        <Icon size={16} className="toast-icon" />
                        <span className="toast-message">{toast.message}</span>
                        <button
                            className="toast-dismiss"
                            onClick={() => onDismiss(toast.id)}
                            aria-label="Dismiss"
                        >
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
