import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Trash2, Clock, FileText, AlertCircle, Edit3, Info, RefreshCw } from 'lucide-react';
import RecurrencePicker from './RecurrencePicker';

// Simple markdown parser for notes display
const parseMarkdown = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n/g, '<br/>');
};

const TaskDetailModal = ({
    task,
    isOpen,
    onClose,
    onSave,
    onComplete,
    onDelete,
    onSetRecurrence,
    isCompleted = false,
    isRecurring = false,
    recurrenceRule = null
}) => {
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [recurrence, setRecurrence] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const notesRef = useRef(null);

    // Task has saved notes = eligible for completion
    const hasSavedNotes = Boolean(task?.notes?.trim());

    // Sync state with task prop
    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
            setNotes(task.notes || '');
            setDueDate(task.due ? task.due.split('T')[0] : '');
            setRecurrence(recurrenceRule);
            setHasChanges(false);
            setShowDeleteConfirm(false);
            // Start in edit mode if no saved notes
            setIsEditing(!task.notes?.trim());
        }
    }, [task, recurrenceRule]);

    // Track changes
    useEffect(() => {
        if (task) {
            const titleChanged = title !== (task.title || '');
            const notesChanged = notes !== (task.notes || '');
            const dueDateChanged = dueDate !== (task.due ? task.due.split('T')[0] : '');
            const recurrenceChanged = recurrence !== recurrenceRule;
            setHasChanges(titleChanged || notesChanged || dueDateChanged || recurrenceChanged);
        }
    }, [title, notes, dueDate, recurrence, task, recurrenceRule]);

    const handleSave = async () => {
        if (!hasChanges) {
            onClose();
            return;
        }

        setIsSaving(true);
        try {
            const updates = { title };
            if (notes.trim()) {
                updates.notes = notes;
            } else {
                updates.notes = '';
            }
            if (dueDate) {
                updates.due = new Date(dueDate).toISOString();
            }
            await onSave(task.id, updates);

            // Handle recurrence separately
            if (recurrence !== recurrenceRule && onSetRecurrence) {
                await onSetRecurrence(task.id, recurrence);
            }

            onClose();
        } catch (e) {
            console.error('Failed to save task:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleComplete = async () => {
        setIsSaving(true);
        try {
            await onComplete(task.id);
            onClose();
        } catch (e) {
            console.error('Failed to complete task:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        setIsSaving(true);
        try {
            await onDelete(task.id);
            onClose();
        } catch (e) {
            console.error('Failed to delete task:', e);
        } finally {
            setIsSaving(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        }
        if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
        }
    };

    if (!isOpen || !task) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="task-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                onKeyDown={handleKeyDown}
            >
                <motion.div
                    className="task-modal"
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="task-modal-header">
                        <div className="task-modal-title-row">
                            <FileText size={18} color="#ea580c" />
                            <span className="task-modal-label">TASK DETAILS</span>
                            {hasChanges && <span className="task-modal-unsaved">Unsaved changes</span>}
                        </div>
                        <button className="task-modal-close" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="task-modal-content">
                        {/* Title Input */}
                        <div className="task-modal-field">
                            <label>Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Task title..."
                                className="task-modal-input"
                                autoFocus
                            />
                        </div>

                        {/* Due Date */}
                        <div className="task-modal-field">
                            <label>
                                <Clock size={14} style={{ marginRight: 6 }} />
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="task-modal-input task-modal-date"
                            />
                        </div>

                        {/* Recurrence */}
                        <div className="task-modal-field">
                            <label>
                                <RefreshCw size={14} style={{ marginRight: 6 }} />
                                Repeat
                                {isRecurring && (
                                    <span className="task-modal-recurring-badge">Recurring</span>
                                )}
                            </label>
                            <RecurrencePicker
                                value={recurrence}
                                onChange={setRecurrence}
                                disabled={isCompleted}
                            />
                        </div>

                        {/* Notes - Edit or Display Mode */}
                        <div className="task-modal-field task-modal-notes-field">
                            <label>
                                Notes
                                {hasSavedNotes && !isEditing && (
                                    <button
                                        className="task-modal-edit-btn"
                                        onClick={() => setIsEditing(true)}
                                        title="Edit notes"
                                    >
                                        <Edit3 size={12} />
                                    </button>
                                )}
                                {isEditing && (
                                    <span className="task-modal-hint">
                                        {notes.length} / 8,192 characters
                                    </span>
                                )}
                            </label>

                            {isEditing ? (
                                <>
                                    <textarea
                                        ref={notesRef}
                                        value={notes}
                                        onChange={(e) => {
                                            if (e.target.value.length <= 8192) {
                                                setNotes(e.target.value);
                                            }
                                        }}
                                        placeholder="Add detailed notes for this task..."
                                        className="task-modal-textarea"
                                        rows={8}
                                    />
                                    {/* Visual cue when notes empty */}
                                    {!notes.trim() && !hasSavedNotes && (
                                        <motion.div
                                            className="task-modal-notes-hint"
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <Info size={14} />
                                            <span>Add notes to enable task completion</span>
                                        </motion.div>
                                    )}
                                </>
                            ) : (
                                <div
                                    className="task-modal-notes-display"
                                    onClick={() => setIsEditing(true)}
                                    dangerouslySetInnerHTML={{ __html: parseMarkdown(notes) }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="task-modal-footer">
                        <div className="task-modal-footer-left">
                            {/* Delete - only if completed, or with confirmation */}
                            {isCompleted ? (
                                <button
                                    className="task-modal-btn task-modal-btn-danger"
                                    onClick={handleDelete}
                                    disabled={isSaving}
                                >
                                    <Trash2 size={14} />
                                    {showDeleteConfirm ? 'Confirm Delete' : 'Delete Task'}
                                </button>
                            ) : (
                                showDeleteConfirm ? (
                                    <div className="task-modal-delete-warning">
                                        <AlertCircle size={14} color="#ef4444" />
                                        <span>Mark as done first to delete</span>
                                        <button
                                            className="task-modal-btn-text"
                                            onClick={() => setShowDeleteConfirm(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="task-modal-btn task-modal-btn-ghost"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        disabled={isSaving}
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                )
                            )}
                        </div>

                        <div className="task-modal-footer-right">
                            {/* Mark as Done - Only non-recurring tasks with notes */}
                            {!isCompleted && hasSavedNotes && !isRecurring && (
                                <button
                                    className="task-modal-btn task-modal-btn-complete"
                                    onClick={handleComplete}
                                    disabled={isSaving}
                                >
                                    <Check size={16} />
                                    Mark as Done
                                </button>
                            )}

                            {/* Save Changes */}
                            <button
                                className="task-modal-btn task-modal-btn-primary"
                                onClick={handleSave}
                                disabled={isSaving || !title.trim()}
                            >
                                {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Close'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TaskDetailModal;
