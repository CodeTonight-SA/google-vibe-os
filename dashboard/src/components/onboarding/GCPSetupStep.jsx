import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, ExternalLink, Terminal, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

const MANUAL_STEPS = [
    'Go to Google Cloud Console',
    'Create a new project (or select existing)',
    'Enable Gmail, Calendar, Drive, and People APIs',
    'Create OAuth 2.0 credentials (Desktop app)',
    'Download the credentials.json file',
];

export default function GCPSetupStep({ onNext, onBack, data }) {
    const [mode, setMode] = useState(null); // 'manual' or 'terraform'
    const [checklist, setChecklist] = useState(MANUAL_STEPS.map(() => false));

    const handleCheckItem = (index) => {
        const newChecklist = [...checklist];
        newChecklist[index] = !newChecklist[index];
        setChecklist(newChecklist);
    };

    const allChecked = checklist.every(Boolean);

    const openGCPConsole = () => {
        window.open('https://console.cloud.google.com/apis/credentials', '_blank');
    };

    if (data.hasCredentials) {
        // Already has credentials, skip this step
        return (
            <div className="step-content">
                <CheckCircle2 size={48} className="success-icon" />
                <h2>Credentials Found</h2>
                <p>You already have valid credentials configured.</p>
                <div className="button-row">
                    <button className="secondary-button" onClick={onBack}>
                        <ArrowLeft size={18} />
                        Back
                    </button>
                    <button className="primary-button" onClick={() => onNext({})}>
                        Continue
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        );
    }

    if (!mode) {
        return (
            <div className="step-content">
                <Cloud size={48} className="step-icon" />
                <h2>Google Cloud Setup</h2>
                <p>Googol Vibe needs OAuth credentials to access your Google account.</p>

                <div className="choice-cards">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="choice-card"
                        onClick={() => setMode('manual')}
                    >
                        <ExternalLink size={32} />
                        <h3>I have a GCP project</h3>
                        <p>Guide me through the setup</p>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="choice-card disabled"
                        onClick={() => setMode('terraform')}
                    >
                        <Terminal size={32} />
                        <h3>Use Terraform</h3>
                        <p>Automate with infrastructure as code</p>
                        <span className="coming-soon">Coming Soon</span>
                    </motion.div>
                </div>

                <button className="text-button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    Back
                </button>
            </div>
        );
    }

    if (mode === 'terraform') {
        return (
            <div className="step-content">
                <Terminal size={48} className="step-icon" />
                <h2>Terraform Setup</h2>
                <p>Terraform automation is coming soon. For now, please use the manual setup.</p>

                <div className="code-block">
                    <code>
                        # Coming in v1.1{'\n'}
                        cd infrastructure/terraform{'\n'}
                        terraform init{'\n'}
                        terraform apply
                    </code>
                </div>

                <div className="button-row">
                    <button className="secondary-button" onClick={() => setMode(null)}>
                        <ArrowLeft size={18} />
                        Back
                    </button>
                    <button className="primary-button" onClick={() => setMode('manual')}>
                        Use Manual Setup
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        );
    }

    // Manual mode
    return (
        <div className="step-content">
            <ExternalLink size={48} className="step-icon" />
            <h2>Manual GCP Setup</h2>
            <p>Complete these steps in Google Cloud Console:</p>

            <div className="checklist">
                {MANUAL_STEPS.map((step, index) => (
                    <motion.div
                        key={index}
                        className={`checklist-item ${checklist[index] ? 'checked' : ''}`}
                        onClick={() => handleCheckItem(index)}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className="checkbox">
                            {checklist[index] && <CheckCircle2 size={16} />}
                        </div>
                        <span>{step}</span>
                    </motion.div>
                ))}
            </div>

            <button className="link-button" onClick={openGCPConsole}>
                <ExternalLink size={16} />
                Open Google Cloud Console
            </button>

            <div className="button-row">
                <button className="secondary-button" onClick={() => setMode(null)}>
                    <ArrowLeft size={18} />
                    Back
                </button>
                <button
                    className="primary-button"
                    onClick={() => onNext({})}
                    disabled={!allChecked}
                >
                    I've downloaded credentials.json
                    <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
}
