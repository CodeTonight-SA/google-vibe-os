import { motion } from 'framer-motion';
import { Sparkles, Mail, Calendar, FileText, ArrowRight } from 'lucide-react';

export default function WelcomeStep({ onNext }) {
    return (
        <div className="step-content welcome-step">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="welcome-logo"
            >
                <Sparkles size={64} className="logo-icon" />
            </motion.div>

            <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                Welcome to Googol Vibe
            </motion.h1>

            <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="welcome-subtitle"
            >
                Your Google Workspace, unified
            </motion.p>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="feature-grid"
            >
                <div className="feature-item">
                    <Mail size={24} />
                    <span>Gmail</span>
                </div>
                <div className="feature-item">
                    <Calendar size={24} />
                    <span>Calendar</span>
                </div>
                <div className="feature-item">
                    <FileText size={24} />
                    <span>Drive</span>
                </div>
            </motion.div>

            <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="setup-time"
            >
                Setup takes about 5 minutes
            </motion.p>

            <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="primary-button"
                onClick={() => onNext({})}
            >
                Get Started
                <ArrowRight size={18} />
            </motion.button>
        </div>
    );
}
