import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileJson, Upload, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, FolderOpen } from 'lucide-react';

export default function CredentialsStep({ onNext, onBack, data }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);

        const file = e.dataTransfer.files[0];
        if (!file) return;

        await processFile(file.path);
    }, []);

    const handleBrowse = async () => {
        setError(null);
        setIsLoading(true);

        try {
            const result = await window.electronAPI.selectCredentialsFile();

            if (result.canceled) {
                setIsLoading(false);
                return;
            }

            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    onNext({ hasCredentials: true });
                }, 1000);
            } else {
                setError(result.error || 'Failed to import credentials');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const processFile = async (filePath) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await window.electronAPI.importCredentials(filePath);

            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    onNext({ hasCredentials: true });
                }, 1000);
            } else {
                setError(result.error || 'Failed to import credentials');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (data.hasCredentials || success) {
        return (
            <div className="step-content">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <CheckCircle2 size={64} className="success-icon" />
                </motion.div>
                <h2>Credentials Imported</h2>
                <p>Your OAuth credentials have been configured successfully.</p>
                {!data.hasCredentials && (
                    <p className="auto-continue">Continuing automatically...</p>
                )}
                {data.hasCredentials && (
                    <button className="primary-button" onClick={() => onNext({})}>
                        Continue
                        <ArrowRight size={18} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="step-content">
            <FileJson size={48} className="step-icon" />
            <h2>Import Credentials</h2>
            <p>Upload the credentials.json file you downloaded from Google Cloud Console.</p>

            <motion.div
                className={`drop-zone ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                whileHover={{ scale: 1.01 }}
            >
                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner" />
                        <span>Importing...</span>
                    </div>
                ) : (
                    <>
                        <Upload size={32} />
                        <p>Drag & drop credentials.json here</p>
                        <span className="or-divider">or</span>
                        <button className="browse-button" onClick={handleBrowse}>
                            <FolderOpen size={16} />
                            Browse Files
                        </button>
                    </>
                )}
            </motion.div>

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
                <p>The file should contain your OAuth 2.0 client credentials.</p>
                <p>It will be stored securely at: <code>~/.googol-vibe/credentials.json</code></p>
            </div>

            <button className="text-button" onClick={onBack}>
                <ArrowLeft size={16} />
                Back
            </button>
        </div>
    );
}
