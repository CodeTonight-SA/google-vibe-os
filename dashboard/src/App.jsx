import { useEffect, useState } from 'react';
import { Mail, Calendar, HardDrive, Clock, FileText, User, LogIn, Sparkles, Video, CheckSquare, FileSpreadsheet, Presentation, Plus, StickyNote, RefreshCw, ExternalLink, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import AgentPanel from './components/AgentPanel';
import OnboardingWizard from './components/OnboardingWizard';
import TaskDetailModal from './components/TaskDetailModal';

// Skeleton loader - Swiss Nihilism style
const Skeleton = ({ width = '100%', height = 16, className = '' }) => (
    <div
        className={`skeleton ${className}`}
        style={{ width, height, borderRadius: 0 }}
    />
);

const SkeletonListItem = () => (
    <div className="list-item" style={{ cursor: 'default' }}>
        <div className="list-content">
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} className="skeleton-sub" />
        </div>
    </div>
);

const SkeletonDocCard = () => (
    <div className="doc-card skeleton-doc">
        <Skeleton width={60} height={16} />
        <Skeleton width="90%" height={14} className="skeleton-sub" />
        <Skeleton width="50%" height={12} className="skeleton-sub" />
    </div>
);

const SkeletonFileCard = () => (
    <div className="file-card">
        <Skeleton width="80%" height={12} />
        <Skeleton width="100%" height={90} className="skeleton-sub" />
    </div>
);

function App() {
    const [emails, setEmails] = useState([]);
    const [events, setEvents] = useState([]);
    const [files, setFiles] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [taskListId, setTaskListId] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [recurrenceRules, setRecurrenceRules] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Per-widget loading states
    const [loadingStates, setLoadingStates] = useState({
        emails: true,
        events: true,
        files: true,
        documents: true,
        meetings: true,
        tasks: true
    });
    const [contentViewOpen, setContentViewOpen] = useState(false);
    const [currentDoc, setCurrentDoc] = useState(null); // { id, type } for edit button
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingChecked, setOnboardingChecked] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setLoadingStates({ emails: true, events: true, files: true, documents: true, meetings: true, tasks: true });

            const profileData = await window.electronAPI.getProfile();
            setProfile(profileData);
            setIsAuthenticated(true);

            // Fetch all data in parallel - each updates independently
            const fetchEmail = window.electronAPI.getGmail()
                .then(data => {
                    setEmails(Array.isArray(data) ? data : []);
                    setLoadingStates(prev => ({ ...prev, emails: false }));
                })
                .catch(e => {
                    console.error("Gmail fetch failed", e);
                    setEmails([]);
                    setLoadingStates(prev => ({ ...prev, emails: false }));
                });

            const fetchEvents = window.electronAPI.getCalendar()
                .then(data => {
                    setEvents(Array.isArray(data) ? data : []);
                    setLoadingStates(prev => ({ ...prev, events: false }));
                })
                .catch(e => {
                    console.error("Calendar fetch failed", e);
                    setEvents([]);
                    setLoadingStates(prev => ({ ...prev, events: false }));
                });

            const fetchFiles = window.electronAPI.getDrive()
                .then(data => {
                    setFiles(Array.isArray(data) ? data : []);
                    setLoadingStates(prev => ({ ...prev, files: false }));
                })
                .catch(e => {
                    console.error("Drive fetch failed", e);
                    setFiles([]);
                    setLoadingStates(prev => ({ ...prev, files: false }));
                });

            const fetchDocs = window.electronAPI.getDocuments()
                .then(data => {
                    setDocuments(Array.isArray(data) ? data : []);
                    setLoadingStates(prev => ({ ...prev, documents: false }));
                })
                .catch(e => {
                    console.error("Documents fetch failed", e);
                    setDocuments([]);
                    setLoadingStates(prev => ({ ...prev, documents: false }));
                });

            const fetchMeetings = window.electronAPI.getMeetings()
                .then(data => {
                    setMeetings(Array.isArray(data) ? data : []);
                    setLoadingStates(prev => ({ ...prev, meetings: false }));
                })
                .catch(e => {
                    console.error("Meetings fetch failed", e);
                    setMeetings([]);
                    setLoadingStates(prev => ({ ...prev, meetings: false }));
                });

            const fetchTasks = window.electronAPI.getTasks()
                .then(data => {
                    setTasks(data.tasks || []);
                    setTaskListId(data.taskListId);
                    setLoadingStates(prev => ({ ...prev, tasks: false }));
                })
                .catch(e => {
                    console.error("Tasks fetch failed", e);
                    setTasks([]);
                    setLoadingStates(prev => ({ ...prev, tasks: false }));
                });

            // Fetch recurrence rules
            const fetchRecurrence = window.electronAPI.getRecurrenceRules()
                .then(rules => {
                    setRecurrenceRules(rules || []);
                })
                .catch(e => {
                    console.error("Recurrence rules fetch failed", e);
                    setRecurrenceRules([]);
                });

            // Wait for all but don't block individual updates
            await Promise.all([fetchEmail, fetchEvents, fetchFiles, fetchDocs, fetchMeetings, fetchTasks, fetchRecurrence]);

        } catch (err) {
            console.error("Failed to fetch data", err);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const checkOnboardingAndFetch = async () => {
            // Check if onboarding is needed
            if (window.electronAPI && window.electronAPI.getOnboardingState) {
                try {
                    const state = await window.electronAPI.getOnboardingState();
                    if (state.needsOnboarding) {
                        setShowOnboarding(true);
                        setOnboardingChecked(true);
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.error('Error checking onboarding state:', e);
                }
            }

            setOnboardingChecked(true);
            fetchData();
        };

        checkOnboardingAndFetch();

        // Set up listeners for content view state
        if (window.electronAPI) {
            window.electronAPI.onContentOpened(() => setContentViewOpen(true));
            window.electronAPI.onContentClosed(() => setContentViewOpen(false));

            // Listen for recurring task generation
            window.electronAPI.onRecurringTaskGenerated((data) => {
                console.log('[Recurrence] Task generated:', data);
                // Refresh tasks to show newly generated recurring task
                window.electronAPI.getTasks().then(taskData => {
                    setTasks(taskData.tasks || []);
                });
            });

            // Listen for sync events
            window.electronAPI.onSyncComplete((status) => {
                setSyncStatus(status);
                setIsSyncing(false);
            });

            window.electronAPI.onGmailSynced((data) => {
                if (data.count > 0) {
                    // Refresh emails when new ones arrive
                    window.electronAPI.getGmail().then(emailData => {
                        setEmails(Array.isArray(emailData) ? emailData : []);
                    });
                }
            });

            window.electronAPI.onCalendarSynced(() => {
                // Refresh calendar
                window.electronAPI.getCalendar().then(data => {
                    setEvents(Array.isArray(data) ? data : []);
                });
            });

            window.electronAPI.onTasksSynced(() => {
                // Refresh tasks
                window.electronAPI.getTasks().then(data => {
                    setTasks(data.tasks || []);
                });
            });

            // Get initial sync status
            window.electronAPI.getSyncStatus().then(status => {
                setSyncStatus(status);
            }).catch(() => {});
        }

        return () => {
            if (window.electronAPI) {
                if (window.electronAPI.removeContentListeners) {
                    window.electronAPI.removeContentListeners();
                }
                if (window.electronAPI.removeSyncListeners) {
                    window.electronAPI.removeSyncListeners();
                }
            }
        };
    }, []);

    const handleLogin = async () => {
        try {
            const res = await window.electronAPI.login();
            if (res.success) {
                fetchData();
            } else {
                console.error("Login failed", res.error);
            }
        } catch (e) {
            console.error("Login invocation failed", e);
        }
    };

    // Show onboarding wizard if needed
    if (showOnboarding) {
        return (
            <OnboardingWizard
                onComplete={() => {
                    setShowOnboarding(false);
                    fetchData();
                }}
            />
        );
    }

    if (loading && !isAuthenticated) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Sparkles className="loading-pulse" color="#ea580c" size={32} />
                    <h1 className="loading-pulse" style={{ color: '#000000', margin: 0, letterSpacing: '-0.03em' }}>Googol Vibe</h1>
                </div>
            </div>
        );
    }

    if (!isAuthenticated && !loading) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 24 }}>
                <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: 0, color: '#000000', letterSpacing: '-0.03em' }}>Googol Vibe</h1>
                <p style={{ color: '#6b7280', margin: 0 }}>Log in to access your intelligent workspace.</p>
                <button
                    onClick={handleLogin}
                    style={{
                        background: '#000000',
                        color: 'white',
                        border: 'none',
                        padding: '16px 32px',
                        borderRadius: 0,
                        fontFamily: 'ui-monospace, "SF Mono", monospace',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontWeight: 500,
                        transition: 'background-color 0.3s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#ea580c'}
                    onMouseLeave={(e) => e.target.style.background = '#000000'}
                >
                    <LogIn size={18} /> Connect Account
                </button>
            </div>
        );
    }

    const handleViewContent = (url, type, docInfo = null) => {
        if (window.electronAPI && window.electronAPI.viewContent) {
            window.electronAPI.viewContent(url, type);
            setCurrentDoc(docInfo); // Track doc for edit button
        } else {
            window.open(url, '_blank');
        }
    };

    const handleSwitchToEdit = () => {
        if (currentDoc && window.electronAPI && window.electronAPI.switchToEdit) {
            window.electronAPI.switchToEdit(currentDoc.id, currentDoc.type);
        }
    };

    const handleAddTask = async () => {
        if (!taskListId) return;

        if (!newTaskTitle.trim()) {
            // Focus the text title input
            document.getElementById('task-title-input').focus();
            return;
        }

        try {
            const newTask = await window.electronAPI.createTask(taskListId, newTaskTitle.trim(), null);
            setNewTaskTitle('');
            // Refresh tasks
            const taskData = await window.electronAPI.getTasks();
            setTasks(taskData.tasks || []);
            // Open modal immediately for notes entry
            if (newTask) {
                setSelectedTask(newTask);
                setIsTaskModalOpen(true);
            }
        } catch (e) {
            console.error("Failed to create task", e);
        }
    };

    const handleOpenTaskModal = (task) => {
        setSelectedTask(task);
        setIsTaskModalOpen(true);
    };

    const handleCloseTaskModal = () => {
        setIsTaskModalOpen(false);
        setSelectedTask(null);
    };

    const handleSaveTask = async (taskId, updates) => {
        if (!taskListId) return;
        try {
            const updatedTask = await window.electronAPI.updateTask(taskListId, taskId, updates);
            // Update local state with the returned task data
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedTask } : t));
        } catch (e) {
            console.error("Failed to update task", e);
            throw e;
        }
    };

    const handleCompleteTask = async (taskId) => {
        if (!taskListId) return;
        try {
            await window.electronAPI.completeTask(taskListId, taskId);
            // Remove from local state
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (e) {
            console.error("Failed to complete task", e);
            throw e;
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!taskListId) return;
        try {
            await window.electronAPI.deleteTask(taskListId, taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (e) {
            console.error("Failed to delete task", e);
            throw e;
        }
    };

    const handleSetRecurrence = async (taskId, rruleString) => {
        if (!taskListId || !selectedTask) return;
        try {
            const result = await window.electronAPI.setTaskRecurrence(
                taskListId,
                taskId,
                selectedTask.title,
                selectedTask.notes || '',
                rruleString
            );
            // Refresh recurrence rules
            const rules = await window.electronAPI.getRecurrenceRules();
            setRecurrenceRules(rules || []);
            return result;
        } catch (e) {
            console.error("Failed to set recurrence", e);
            throw e;
        }
    };

    // Helper to check if a task has a recurrence rule
    const getRecurrenceForTask = (task) => {
        if (!task || !recurrenceRules) return null;
        return recurrenceRules.find(r => r.title === task.title && r.taskListId === taskListId);
    };

    const handleLogout = async () => {
        await window.electronAPI.logout();
        setIsAuthenticated(false);
        setProfile(null);
    };

    const handleCloseContent = () => {
        if (window.electronAPI && window.electronAPI.closeContent) {
            window.electronAPI.closeContent();
            setCurrentDoc(null);
        }
    };

    // Helper to get document type from mimeType
    const getDocType = (mimeType) => {
        if (mimeType.includes('document')) return 'document';
        if (mimeType.includes('spreadsheet')) return 'spreadsheet';
        if (mimeType.includes('presentation')) return 'presentation';
        return 'document';
    };

    // Helper to get preview URL
    const getPreviewUrl = (id, mimeType) => {
        const type = getDocType(mimeType);
        const urls = {
            'document': `https://docs.google.com/document/d/${id}/preview`,
            'spreadsheet': `https://docs.google.com/spreadsheets/d/${id}/preview`,
            'presentation': `https://docs.google.com/presentation/d/${id}/preview`
        };
        return urls[type];
    };

    // Helper to get doc icon
    const getDocIcon = (mimeType) => {
        if (mimeType.includes('spreadsheet')) return <FileSpreadsheet color="#34a853" size={16} />;
        if (mimeType.includes('presentation')) return <Presentation color="#fbbc04" size={16} />;
        return <FileText color="#4285f4" size={16} />;
    };

    return (
        <div className="dashboard-container" style={contentViewOpen ? {
            background: '#ffffff',
            padding: 0,
            minHeight: '100vh',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
        } : {}}>
            {/* White header bar when content view is open */}
            {contentViewOpen && (
                <header style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10000,
                    background: '#ffffff',
                    padding: '12px 24px',
                    height: '80px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 12
                }}>
                    {currentDoc && (
                        <div
                            style={{
                                background: '#ea580c',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'ui-monospace, "SF Mono", monospace',
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                            onClick={handleSwitchToEdit}
                        >
                            Edit
                        </div>
                    )}
                    <div
                        style={{
                            background: '#000000',
                            color: 'white',
                            padding: '10px 20px',
                            borderRadius: 0,
                            cursor: 'pointer',
                            fontFamily: 'ui-monospace, "SF Mono", monospace',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                        onClick={handleCloseContent}
                    >
                        Back to Dashboard
                    </div>
                </header>
            )}
            {!contentViewOpen && (
                <header className="header">
                    <div className="header-content">
                        <p style={{ margin: 0, fontFamily: 'ui-monospace, "SF Mono", monospace', fontSize: '0.75rem', color: '#ea580c', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>WELCOME BACK</p>
                        <h1>Google Vibe OS</h1>
                        {profile && (
                            <p>
                                Ready to work, <b>{profile.name}</b>.
                            </p>
                        )}
                    </div>

                    {isAuthenticated && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {/* Sync Status Indicator */}
                            <div
                                onClick={async () => {
                                    if (isSyncing) return;
                                    setIsSyncing(true);
                                    try {
                                        const status = await window.electronAPI.forceSync('all');
                                        setSyncStatus(status);
                                    } catch (e) {
                                        console.error('Force sync failed', e);
                                    }
                                    setIsSyncing(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    cursor: 'pointer',
                                    padding: '6px 10px',
                                    background: isSyncing ? '#f3f4f6' : 'transparent',
                                    border: '1px solid #e5e7eb',
                                    transition: 'all 0.2s'
                                }}
                                title={syncStatus?.gmail?.lastSync ? `Last sync: ${new Date(syncStatus.gmail.lastSync).toLocaleTimeString()}` : 'Click to sync'}
                            >
                                <Radio
                                    size={14}
                                    color={isSyncing ? '#ea580c' : '#22c55e'}
                                    className={isSyncing ? 'sync-pulse' : ''}
                                />
                                <span style={{
                                    fontFamily: 'ui-monospace, "SF Mono", monospace',
                                    fontSize: '0.625rem',
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {isSyncing ? 'Syncing...' : 'Live'}
                                </span>
                            </div>
                            {profile && <img src={profile.picture} alt="Profile" referrerPolicy="no-referrer" style={{ width: 44, height: 44, borderRadius: 0, border: '1px solid #d1d5db' }} />}
                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid #000000',
                                    color: '#000000',
                                    padding: '8px 16px',
                                    borderRadius: 0,
                                    cursor: 'pointer',
                                    fontFamily: 'ui-monospace, "SF Mono", monospace',
                                    fontSize: '0.625rem',
                                    fontWeight: 500,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em'
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </header>
            )}

            {!contentViewOpen && (
                <div className="grid">
                    {/* Main Content Area (9 Columns) */}
                    <div className="col-span-9">
                        <div className="grid" style={{ gap: '24px' }}>
                            {/* Mail Widget */}
                            <div className="col-span-7">
                                <motion.div
                                    className="card"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}>
                                    <div className="card-header">
                                        <div className="card-title">
                                            <Mail color="#ea580c" size={18} /> Inbox
                                        </div>
                                        <span className="badge">{emails.length} New</span>
                                    </div>
                                    <div className="widget-scroll">
                                        {loadingStates.emails ? (
                                            <>
                                                <SkeletonListItem />
                                                <SkeletonListItem />
                                                <SkeletonListItem />
                                                <SkeletonListItem />
                                            </>
                                        ) : emails.length > 0 ? (
                                            emails.map(email => (
                                                <div
                                                    key={email.id}
                                                    className="list-item"
                                                    onClick={() => handleViewContent(`https://mail.google.com/mail/u/0/#inbox/${email.id}`, 'email')}
                                                >
                                                    <div className="list-content">
                                                        <div className="item-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>{email.from.split('<')[0].replace(/"/g, '')}</span>
                                                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'ui-monospace, "SF Mono", monospace' }}>{new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        <div className="item-sub">{email.subject}</div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>No new emails</div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Tasks Widget */}
                            <div className="col-span-5">
                                <motion.div
                                    className="card"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.05 }}
                                >
                                    <div className="card-header">
                                        <div
                                            className="card-title"
                                            onClick={() => handleViewContent('https://tasks.google.com/', 'tasks')}
                                            style={{ cursor: 'pointer' }}
                                            title="Open Google Tasks"
                                        >
                                            <CheckSquare color="#ea580c" size={18} /> Tasks
                                            <ExternalLink size={14} style={{ marginLeft: 6, opacity: 0.5 }} />
                                            {loadingStates.tasks && (
                                                <div className="task-loading-indicator">
                                                    <div className="task-loading-dot" />
                                                    Loading
                                                </div>
                                            )}
                                        </div>
                                        <span className="badge">{tasks.length} Pending</span>
                                    </div>
                                    <div>
                                        {/* Add Task Input */}
                                        <div id="task-title-input" style={{ display: 'flex', gap: 8, padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <input
                                                type="text"
                                                placeholder="Enter task title..."
                                                value={newTaskTitle}
                                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                                style={{
                                                    flex: 1,
                                                    border: '1px solid #d1d5db',
                                                    padding: '8px 12px',
                                                    fontSize: '0.875rem',
                                                    outline: 'none',
                                                    fontFamily: 'inherit'
                                                }}
                                            />
                                            <button
                                                onClick={handleAddTask}
                                                style={{
                                                    background: '#ea580c',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 12px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        {/* Task List - Click to open detail modal */}
                                        <div className="widget-scroll-sm">
                                            {loadingStates.tasks ? (
                                                <>
                                                    <SkeletonListItem />
                                                    <SkeletonListItem />
                                                    <SkeletonListItem />
                                                </>
                                            ) : tasks.length > 0 ? (
                                                tasks.map((task) => {
                                                    const isRecurring = Boolean(getRecurrenceForTask(task));
                                                    return (
                                                        <div
                                                            key={task.id}
                                                            className={`list-item task-item-clickable ${isRecurring ? 'task-recurring' : ''}`}
                                                            onClick={() => handleOpenTaskModal(task)}
                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                                        >
                                                            <div className="list-content" style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                    {isRecurring && (
                                                                        <span className="task-recurring-icon">
                                                                            <RefreshCw size={12} />
                                                                        </span>
                                                                    )}
                                                                    <span className="task-item-title">{task.title}</span>
                                                                    {task.notes && (
                                                                        <span className="task-item-has-notes">
                                                                            <StickyNote size={12} />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {task.due && (
                                                                    <div className="item-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <Clock size={12} />
                                                                        {new Date(task.due).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>No pending tasks</div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Calendar Widget */}
                            <div className="col-span-6">
                                <motion.div
                                    className="card"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.1 }}
                                >
                                    <div className="card-header">
                                        <div className="card-title">
                                            <Calendar color="#ea580c" size={18} /> Up Next
                                        </div>
                                    </div>
                                    <div className="widget-scroll-sm">
                                        {loadingStates.events ? (
                                            <>
                                                <SkeletonListItem />
                                                <SkeletonListItem />
                                                <SkeletonListItem />
                                            </>
                                        ) : events.length > 0 ? (
                                            events.map((event, i) => {
                                                const isMeet = event.htmlLink && event.htmlLink.includes('meet');
                                                return (
                                                    <div
                                                        key={i}
                                                        className="list-item"
                                                        onClick={() => handleViewContent(event.htmlLink, isMeet ? 'meet' : 'calendar')}
                                                    >
                                                        <div className="list-content">
                                                            <div className="item-title">{event.summary}</div>
                                                            <div className="item-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <Clock size={12} />
                                                                {event.start && new Date(event.start).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>No upcoming events</div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Meetings Widget */}
                            <div className="col-span-6">
                                <motion.div
                                    className="card"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.15 }}
                                >
                                    <div className="card-header">
                                        <div className="card-title">
                                            <Video color="#ea580c" size={18} /> Meetings
                                        </div>
                                        <span className="badge">{meetings.length} This Week</span>
                                    </div>
                                    <div className="widget-scroll-sm">
                                        {loadingStates.meetings ? (
                                            <>
                                                <SkeletonListItem />
                                                <SkeletonListItem />
                                                <SkeletonListItem />
                                            </>
                                        ) : meetings.length > 0 ? (
                                            meetings.slice(0, 5).map((meeting) => (
                                                <div
                                                    key={meeting.id}
                                                    className="list-item"
                                                    onClick={() => handleViewContent(meeting.meetLink, 'meet')}
                                                >
                                                    <div className="list-content">
                                                        <div className="item-title">{meeting.summary}</div>
                                                        <div className="item-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <Clock size={12} />
                                                            {new Date(meeting.start).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            {meeting.attendees > 0 && <span style={{ marginLeft: 8 }}>({meeting.attendees} attendees)</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>No meetings scheduled</div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Documents Widget - Horizontal Scroll Cards */}
                            <div className="col-span-12">
                                <motion.div
                                    className="card"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                >
                                    <div className="card-header">
                                        <div className="card-title">
                                            <FileText color="#ea580c" size={18} /> Documents
                                        </div>
                                        <span className="badge">{documents.length} Total</span>
                                    </div>
                                    <div className="doc-scroll">
                                        {loadingStates.documents ? (
                                            <>
                                                <SkeletonDocCard />
                                                <SkeletonDocCard />
                                                <SkeletonDocCard />
                                                <SkeletonDocCard />
                                            </>
                                        ) : documents.length > 0 ? (
                                            documents.slice(0, 8).map((doc) => (
                                                <div
                                                    key={doc.id}
                                                    className="doc-card"
                                                    onClick={() => handleViewContent(
                                                        getPreviewUrl(doc.id, doc.mimeType),
                                                        'document',
                                                        { id: doc.id, type: getDocType(doc.mimeType) }
                                                    )}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {getDocIcon(doc.mimeType)}
                                                        <span style={{ fontSize: '0.7rem', color: '#6b7280', fontFamily: 'ui-monospace', textTransform: 'uppercase' }}>
                                                            {getDocType(doc.mimeType)}
                                                        </span>
                                                    </div>
                                                    <div className="item-title-truncate">{doc.name}</div>
                                                    <div className="item-sub" style={{ marginTop: 4 }}>
                                                        {doc.modifiedTime && new Date(doc.modifiedTime).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ color: '#6b7280', textAlign: 'center', padding: 20, width: '100%' }}>No documents</div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Files Widget */}
                            <div className="col-span-12">
                                <motion.div
                                    className="card"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.3 }}
                                >
                                    <div className="card-header">
                                        <div className="card-title">
                                            <HardDrive color="#ea580c" size={18} /> Recent Files
                                        </div>
                                    </div>
                                    <div className="file-grid">
                                        {loadingStates.files ? (
                                            <>
                                                <SkeletonFileCard />
                                                <SkeletonFileCard />
                                                <SkeletonFileCard />
                                                <SkeletonFileCard />
                                                <SkeletonFileCard />
                                                <SkeletonFileCard />
                                            </>
                                        ) : files.length > 0 ? (
                                            files.slice(0, 6).map(file => (
                                                <div
                                                    key={file.id}
                                                    className="file-card"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => handleViewContent(file.webViewLink, 'file')}
                                                >
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 500, marginBottom: 8, overflow: 'hidden', width: '100%', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1a1a1a' }}>{file.name}</div>
                                                    {file.thumbnailLink ? (
                                                        <img src={file.thumbnailLink} className="file-thumb" alt={file.name} referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="file-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <FileText color="#9ca3af" size={32} />
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>No accessible files</div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>

                    {/* Agent Sidebar (3 Columns) */}
                    <div className="col-span-3">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <AgentPanel />
                        </motion.div>
                    </div>
                </div>
            )}

            {/* Task Detail Modal */}
            <TaskDetailModal
                task={selectedTask}
                isOpen={isTaskModalOpen}
                onClose={handleCloseTaskModal}
                onSave={handleSaveTask}
                onComplete={handleCompleteTask}
                onDelete={handleDeleteTask}
                onSetRecurrence={handleSetRecurrence}
                isRecurring={selectedTask ? Boolean(getRecurrenceForTask(selectedTask)) : false}
                recurrenceRule={selectedTask ? getRecurrenceForTask(selectedTask)?.rrule : null}
            />
        </div>
    );
}

export default App;
