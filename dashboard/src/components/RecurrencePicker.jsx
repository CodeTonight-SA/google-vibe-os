import { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const WEEKDAYS = [
    { id: 0, short: 'M', full: 'Monday' },
    { id: 1, short: 'T', full: 'Tuesday' },
    { id: 2, short: 'W', full: 'Wednesday' },
    { id: 3, short: 'T', full: 'Thursday' },
    { id: 4, short: 'F', full: 'Friday' },
    { id: 5, short: 'S', full: 'Saturday' },
    { id: 6, short: 'S', full: 'Sunday' }
];

const FREQUENCIES = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom...' }
];

const RecurrencePicker = ({ value, onChange, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [frequency, setFrequency] = useState('none');
    const [interval, setInterval] = useState(1);
    const [weekdays, setWeekdays] = useState([]);
    const [monthday, setMonthday] = useState(1);
    const [showCustom, setShowCustom] = useState(false);

    // Parse incoming value
    useEffect(() => {
        if (!value) {
            setFrequency('none');
            return;
        }

        // Parse RRULE string
        const freqMatch = value.match(/FREQ=(\w+)/);
        const intervalMatch = value.match(/INTERVAL=(\d+)/);
        const bydayMatch = value.match(/BYDAY=([^;]+)/);
        const bymonthdayMatch = value.match(/BYMONTHDAY=(\d+)/);

        if (freqMatch) {
            const freq = freqMatch[1].toLowerCase();
            setFrequency(freq);

            if (intervalMatch) {
                const intVal = parseInt(intervalMatch[1], 10);
                setInterval(intVal);
                if (intVal > 1) setShowCustom(true);
            }

            if (bydayMatch) {
                const dayMap = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
                const days = bydayMatch[1].split(',').map(d => dayMap[d.trim()]).filter(d => d !== undefined);
                setWeekdays(days);
                if (days.length > 1 || (days.length === 1 && days[0] !== new Date().getDay())) {
                    setShowCustom(true);
                }
            }

            if (bymonthdayMatch) {
                setMonthday(parseInt(bymonthdayMatch[1], 10));
            }
        }
    }, [value]);

    // Build RRULE string from state
    const buildRRule = () => {
        if (frequency === 'none') return null;

        const parts = [`FREQ=${frequency.toUpperCase()}`];

        if (interval > 1) {
            parts.push(`INTERVAL=${interval}`);
        }

        if (frequency === 'weekly' && weekdays.length > 0) {
            const dayNames = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
            parts.push(`BYDAY=${weekdays.map(d => dayNames[d]).join(',')}`);
        }

        if (frequency === 'monthly' && monthday) {
            parts.push(`BYMONTHDAY=${monthday}`);
        }

        return `RRULE:${parts.join(';')}`;
    };

    // Update parent when state changes
    const handleApply = () => {
        const rrule = buildRRule();
        onChange(rrule);
        setIsOpen(false);
    };

    const handleFrequencyChange = (newFreq) => {
        setFrequency(newFreq);
        if (newFreq === 'custom') {
            setShowCustom(true);
            setFrequency('daily'); // Default to daily for custom
        } else {
            setShowCustom(false);
            setInterval(1);
            setWeekdays([]);
        }
    };

    const toggleWeekday = (dayId) => {
        setWeekdays(prev =>
            prev.includes(dayId)
                ? prev.filter(d => d !== dayId)
                : [...prev, dayId].sort()
        );
    };

    const getDisplayText = () => {
        if (!value || frequency === 'none') return 'Does not repeat';

        if (interval === 1) {
            if (frequency === 'daily') return 'Daily';
            if (frequency === 'weekly') {
                if (weekdays.length === 0) return 'Weekly';
                const dayNames = weekdays.map(d => WEEKDAYS[d].full);
                return `Weekly on ${dayNames.join(', ')}`;
            }
            if (frequency === 'monthly') return `Monthly on day ${monthday}`;
        }

        return `Every ${interval} ${frequency}`;
    };

    return (
        <div className="recurrence-picker">
            <button
                type="button"
                className={`recurrence-picker-trigger ${value ? 'has-recurrence' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <RefreshCw size={14} className={value ? 'recurrence-active' : ''} />
                <span>{getDisplayText()}</span>
                <ChevronDown size={14} className={`recurrence-chevron ${isOpen ? 'open' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="recurrence-dropdown"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                    >
                        <div className="recurrence-section">
                            <label className="recurrence-label">Repeat</label>
                            <div className="recurrence-options">
                                {FREQUENCIES.map(f => (
                                    <button
                                        key={f.value}
                                        type="button"
                                        className={`recurrence-option ${
                                            (f.value === frequency) ||
                                            (f.value === 'custom' && showCustom)
                                                ? 'selected' : ''
                                        }`}
                                        onClick={() => handleFrequencyChange(f.value)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {showCustom && frequency !== 'none' && (
                            <>
                                <div className="recurrence-section">
                                    <label className="recurrence-label">Every</label>
                                    <div className="recurrence-interval">
                                        <input
                                            type="number"
                                            min="1"
                                            max="99"
                                            value={interval}
                                            onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                            className="recurrence-input"
                                        />
                                        <span className="recurrence-unit">
                                            {frequency === 'daily' && (interval === 1 ? 'day' : 'days')}
                                            {frequency === 'weekly' && (interval === 1 ? 'week' : 'weeks')}
                                            {frequency === 'monthly' && (interval === 1 ? 'month' : 'months')}
                                        </span>
                                    </div>
                                </div>

                                {frequency === 'weekly' && (
                                    <div className="recurrence-section">
                                        <label className="recurrence-label">On days</label>
                                        <div className="recurrence-weekdays">
                                            {WEEKDAYS.map(day => (
                                                <button
                                                    key={day.id}
                                                    type="button"
                                                    className={`recurrence-weekday ${weekdays.includes(day.id) ? 'selected' : ''}`}
                                                    onClick={() => toggleWeekday(day.id)}
                                                    title={day.full}
                                                >
                                                    {day.short}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {frequency === 'monthly' && (
                                    <div className="recurrence-section">
                                        <label className="recurrence-label">On day</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={monthday}
                                            onChange={(e) => setMonthday(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                                            className="recurrence-input"
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        <div className="recurrence-actions">
                            <button
                                type="button"
                                className="recurrence-btn recurrence-btn-cancel"
                                onClick={() => setIsOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="recurrence-btn recurrence-btn-apply"
                                onClick={handleApply}
                            >
                                Apply
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RecurrencePicker;
