/**
 * How a message's age is shown: a short "when" beside the sender, and a plain
 * age ("12 days ago") with a tone that warms as the message gets older.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar days since the date: 0 today, 1 yesterday. Null for a date that cannot be read. */
export function daysAgo(date, now = new Date()) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
}

/** The time for today, "Yesterday", the weekday within a week, and otherwise the date. */
export function formatWhen(date, now = new Date()) {
    const d = new Date(date);
    const days = daysAgo(d, now);
    if (days === null) return '';
    if (days <= 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** "Today", "1 day ago" or "12 days ago"; empty for a date that cannot be read. */
export function ageText(date, now = new Date()) {
    const days = daysAgo(date, now);
    if (days === null) return '';
    if (days <= 0) return 'Today';
    return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** 'fresh' up to a day old, 'aging' from 2 days, 'old' from 7 days. */
export function ageTone(date, now = new Date()) {
    const days = daysAgo(date, now);
    if (days === null || days < 2) return 'fresh';
    return days < 7 ? 'aging' : 'old';
}

/** How many of the messages are still unread. */
export function unreadCount(emails) {
    return (emails || []).filter(e => e && e.unread).length;
}
