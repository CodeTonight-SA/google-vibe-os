/**
 * How a message's age is shown: a short "when" beside the sender, and a plain
 * age ("12 days ago") with a tone that warms as the message gets older.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calendar days since the date: 0 today (and for a date in the future), 1
 * yesterday. Null for a date that cannot be read. The same rule as `ageInDays`
 * in electron/mail-advice.js; a parity test pins the two together.
 */
export function daysAgo(date, now = new Date()) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return Math.max(0, Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS));
}

/** The time for today, "Yesterday", the weekday within a week, and otherwise the date. */
export function formatWhen(date, now = new Date()) {
    const d = new Date(date);
    const days = daysAgo(d, now);
    if (days === null) return '';
    if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** "Today", "1 day ago" or "12 days ago" for a day count; empty when the count is unknown. */
export function ageTextFor(days) {
    if (days === null || days === undefined) return '';
    if (days === 0) return 'Today';
    return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** 'fresh' up to a day old, 'aging' from 2 days, 'old' from 7 days. */
export function ageToneFor(days) {
    if (days === null || days === undefined || days < 2) return 'fresh';
    return days < 7 ? 'aging' : 'old';
}

/** The age of a date, in words. */
export function ageText(date, now = new Date()) {
    return ageTextFor(daysAgo(date, now));
}

/** The tone for the age of a date. */
export function ageTone(date, now = new Date()) {
    return ageToneFor(daysAgo(date, now));
}

/**
 * The day count to show for a message: the count its advice was worked out
 * with, when the main process sent one, so the label and the advice always
 * describe the same moment.
 */
export function messageAgeDays(email, now = new Date()) {
    return Number.isInteger(email.ageDays) ? email.ageDays : daysAgo(email.receivedAt || email.date, now);
}

/** The sender's display name from a From header, without the address or quotes. */
export function senderName(from) {
    return String(from || '').split('<')[0].replace(/"/g, '').trim();
}

/** How many of the messages are still unread. */
export function unreadCount(emails) {
    return (emails || []).filter(e => e && e.unread).length;
}
