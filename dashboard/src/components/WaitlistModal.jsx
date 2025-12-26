import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, Check, Loader2 } from 'lucide-react';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqywgvl';

const WaitlistModal = ({ isOpen, onClose, userQuery }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        useCase: '',
        query: userQuery || ''
    });
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');
        setErrorMessage('');

        try {
            const response = await fetch(FORMSPREE_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    ...formData,
                    _subject: `Vibe AI Waitlist: ${formData.name}`,
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                setStatus('success');
            } else {
                throw new Error('Submission failed');
            }
        } catch (err) {
            setStatus('error');
            setErrorMessage('Failed to submit. Please try again.');
        }
    };

    return (
        <div className="waitlist-overlay" onClick={onClose}>
            <div className="waitlist-modal" onClick={e => e.stopPropagation()}>
                <button className="waitlist-close" onClick={onClose}>
                    <X size={20} />
                </button>

                {status === 'success' ? (
                    <div className="waitlist-success">
                        <div className="success-icon-container">
                            <Check size={32} strokeWidth={1.5} />
                        </div>
                        <h2>You're on the list</h2>
                        <p>We'll notify you when Vibe AI launches.</p>
                        <button className="primary-button" onClick={onClose}>
                            Close
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="waitlist-header">
                            <Sparkles size={24} strokeWidth={1} />
                            <h2>Vibe AI</h2>
                            <span className="waitlist-badge">Coming Soon</span>
                        </div>

                        <p className="waitlist-description">
                            AI-powered automation for your Google Workspace.
                            Natural language commands to manage email, calendar, and files.
                        </p>

                        {userQuery && (
                            <div className="waitlist-query-preview">
                                <span className="query-label">Your request</span>
                                <span className="query-text">"{userQuery}"</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="waitlist-form">
                            <div className="form-group">
                                <label htmlFor="name">Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Your name"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="you@company.com"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="company">Company <span className="optional">(Optional)</span></label>
                                <input
                                    type="text"
                                    id="company"
                                    name="company"
                                    value={formData.company}
                                    onChange={handleChange}
                                    placeholder="Company name"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="useCase">What would you use Vibe AI for?</label>
                                <textarea
                                    id="useCase"
                                    name="useCase"
                                    value={formData.useCase}
                                    onChange={handleChange}
                                    placeholder="e.g., Automate email triage, schedule meetings from natural language..."
                                    rows={3}
                                    required
                                />
                            </div>

                            {errorMessage && (
                                <div className="form-error">{errorMessage}</div>
                            )}

                            <button
                                type="submit"
                                className="primary-button waitlist-submit"
                                disabled={status === 'submitting'}
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <Loader2 size={16} className="spin" />
                                        Submitting
                                    </>
                                ) : (
                                    <>
                                        Join Waitlist
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="waitlist-footer">
                            No spam. Unsubscribe anytime.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default WaitlistModal;
