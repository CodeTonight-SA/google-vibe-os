import { motion } from 'framer-motion';
import { Check, Mail, Calendar, FileText, MessageSquare, ArrowRight } from 'lucide-react';

const FEATURES = [
    { icon: Mail, label: 'Gmail inbox at a glance' },
    { icon: Calendar, label: 'Upcoming events & meetings' },
    { icon: FileText, label: 'Recent Drive files' },
    { icon: MessageSquare, label: 'AI-powered agent' },
];

// Swiss Geometric Mark - minimal cross/plus symbol
const SwissMark = () => (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="32" y1="8" x2="32" y2="56" stroke="currentColor" strokeWidth="1.5" />
        <line x1="8" y1="32" x2="56" y2="32" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="32" cy="8" r="2" fill="currentColor" />
        <circle cx="32" cy="56" r="2" fill="currentColor" />
        <circle cx="8" cy="32" r="2" fill="currentColor" />
        <circle cx="56" cy="32" r="2" fill="currentColor" />
    </svg>
);

export default function ReadyStep({ onFinish, data }) {
    return (
        <div className="step-content ready-step">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="success-animation"
            >
                <SwissMark />
            </motion.div>

            <motion.h1
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
            >
                Ready
            </motion.h1>

            {data.connectedEmail && (
                <motion.p
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.4 }}
                    className="connected-as"
                >
                    Connected as <strong>{data.connectedEmail}</strong>
                </motion.p>
            )}

            <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="feature-summary"
            >
                {FEATURES.map((feature, index) => (
                    <motion.div
                        key={feature.label}
                        className="feature-row"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.45 + index * 0.08 }}
                    >
                        <Check size={14} className="check-icon" strokeWidth={2} />
                        <feature.icon size={16} strokeWidth={1.5} />
                        <span>{feature.label}</span>
                    </motion.div>
                ))}
            </motion.div>

            <motion.button
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="primary-button large"
                onClick={onFinish}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
            >
                OPEN DASHBOARD
                <ArrowRight size={18} strokeWidth={1.5} />
            </motion.button>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="tip-text"
            >
                Use the Vibe Agent to query your data naturally
            </motion.p>
        </div>
    );
}
