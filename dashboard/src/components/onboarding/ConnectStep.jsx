import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, LogIn, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

export default function ConnectStep({ onNext, onBack, data }) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    const handleConnect = async () => {
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
            } else {
                setError(result.error || 'Failed to connect to Google');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsConnecting(false);
        }
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
                    <li>Read your Gmail messages</li>
                    <li>View your Calendar events</li>
                    <li>View your Drive files</li>
                    <li>View your Tasks</li>
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
                        Connecting...
                    </>
                ) : (
                    <>
                        <LogIn size={20} />
                        Connect Google Account
                    </>
                )}
            </motion.button>

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
                <p>A browser window will open for Google authentication.</p>
                <p>Your data stays on your device - we never store it on external servers.</p>
            </div>

            <button className="text-button" onClick={onBack}>
                <ArrowLeft size={16} />
                Back
            </button>
        </div>
    );
}
