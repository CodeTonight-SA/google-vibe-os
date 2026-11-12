import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { User, LogIn, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Loader2, X } from 'lucide-react';

export default function ConnectStep({ onNext, onBack, data }) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);
    // Set when the user clicks Cancel, so the failed login it causes shows no error.
    const cancelled = useRef(false);

    const handleConnect = async () => {
        cancelled.current = false;
        setIsConnecting(true);
        setError(null);

        try {
            const result = await window.electronAPI.login();

            if (result.success) {
                // Get profile to confirm connection
                const profile = await window.electronAPI.getProfile();
                onNext({
                    isConnected: true,
                    connectedEmail: profile.email,
                });
            } else if (!cancelled.current) {
                setError(result.error || 'Failed to connect to Google');
            }
        } catch (err) {
            if (!cancelled.current) setError(err.message);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleCancel = () => {
        cancelled.current = true;
        window.electronAPI.cancelLogin();
    };

    if (data.isConnected) {
        return (
            <div className="step-content">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <CheckCircle2 size={64} className="success-icon" />
                </motion.div>
                <h2>Connected!</h2>
                <p className="connected-email">{data.connectedEmail}</p>
                <button className="primary-button" onClick={() => onNext({})}>
                    Continue
                    <ArrowRight size={18} />
                </button>
            </div>
        );
    }

    return (
        <div className="step-content">
            <User size={48} className="step-icon" />
            <h2>Connect Your Google Account</h2>
            <p>Sign in with Google to access your Gmail, Calendar, and Drive.</p>

            <div className="permission-list">
                <h4>Googol Vibe will request access to:</h4>
                <ul>
                    <li>See your email address, name and picture</li>
                    <li>Read your Gmail messages</li>
                    <li>View your Calendar events</li>
                    <li>View your Drive files</li>
                    <li>Read and manage your Tasks</li>
                </ul>
            </div>

            <motion.button
                className="connect-button"
                onClick={handleConnect}
                disabled={isConnecting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {isConnecting ? (
                    <>
                        <Loader2 size={20} className="spin" />
                        Finish signing in in your browser
                    </>
                ) : (
                    <>
                        <LogIn size={20} />
                        Connect Google Account
                    </>
                )}
            </motion.button>

            {isConnecting && (
                <button className="text-button" onClick={handleCancel}>
                    <X size={16} />
                    Cancel sign-in
                </button>
            )}

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="error-message"
                >
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </motion.div>
            )}

            <div className="help-text">
                <p>Google sign-in opens in your web browser. Googol Vibe waits up to 5 minutes for you to finish there.</p>
                <p>Your data stays on your device - we never store it on external servers.</p>
            </div>

            <button className="text-button" onClick={onBack}>
                <ArrowLeft size={16} />
                Back
            </button>
        </div>
    );
}
