import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import WelcomeStep from './onboarding/WelcomeStep';
import GCPSetupStep from './onboarding/GCPSetupStep';
import CredentialsStep from './onboarding/CredentialsStep';
import ConnectStep from './onboarding/ConnectStep';
import ReadyStep from './onboarding/ReadyStep';

const STEPS = [
    { id: 'welcome', title: 'Welcome', component: WelcomeStep },
    { id: 'gcp', title: 'GCP Setup', component: GCPSetupStep },
    { id: 'credentials', title: 'Credentials', component: CredentialsStep },
    { id: 'connect', title: 'Connect', component: ConnectStep },
    { id: 'ready', title: 'Ready', component: ReadyStep },
];

export default function OnboardingWizard({ onComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [stepData, setStepData] = useState({
        hasCredentials: false,
        isConnected: false,
        connectedEmail: null,
        error: null,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkInitialState();
    }, []);

    const checkInitialState = async () => {
        try {
            const state = await window.electronAPI.getOnboardingState();

            // If already has credentials and token, skip to ready
            if (state.hasCredentials && state.hasToken) {
                setStepData({
                    hasCredentials: true,
                    isConnected: true,
                    connectedEmail: state.connectedEmail,
                    error: null,
                });
                setCurrentStep(4); // Ready step
            } else if (state.hasCredentials) {
                // Has credentials but no token - go to connect step
                setStepData(prev => ({ ...prev, hasCredentials: true }));
                setCurrentStep(3); // Connect step
            }
        } catch (error) {
            console.error('Error checking initial state:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleStepComplete = (data) => {
        setStepData(prev => ({ ...prev, ...data }));
        handleNext();
    };

    const handleFinish = () => {
        onComplete();
    };

    const StepComponent = STEPS[currentStep].component;

    if (isLoading) {
        return (
            <div className="onboarding-container">
                <div className="loading-spinner">
                    <Sparkles className="animate-pulse" size={48} />
                </div>
            </div>
        );
    }

    return (
        <div className="onboarding-container">
            {/* Progress indicator */}
            <div className="onboarding-progress">
                {STEPS.map((step, index) => (
                    <div
                        key={step.id}
                        className={`progress-step ${index <= currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                    >
                        <div className="step-dot">
                            {index < currentStep ? <Check size={12} /> : index + 1}
                        </div>
                        <span className="step-label">{step.title}</span>
                    </div>
                ))}
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="onboarding-content"
                >
                    <StepComponent
                        data={stepData}
                        onNext={handleStepComplete}
                        onBack={handleBack}
                        onFinish={handleFinish}
                        isFirst={currentStep === 0}
                        isLast={currentStep === STEPS.length - 1}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Error display */}
            {stepData.error && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="onboarding-error"
                >
                    <AlertCircle size={16} />
                    <span>{stepData.error}</span>
                </motion.div>
            )}
        </div>
    );
}
