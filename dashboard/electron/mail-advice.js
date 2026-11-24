/**
 * How old an inbox message is, and whether it needs a reply from you.
 *
 * These are pure functions, so the rules are tested without Gmail. The main
 * process gives them what one metadata fetch already returns (the headers and
 * the labels), plus whether you wrote the last message in the conversation.
 */

/** A person's mail at least this many days old, with no reply from you, earns "Follow up". */
const FOLLOW_UP_AFTER_DAYS = 2;

/** Gmail's tabs for bulk mail. A message in the Primary tab carries none of these. */
const BULK_CATEGORIES = new Set([
    'CATEGORY_PROMOTIONS',
    'CATEGORY_SOCIAL',
    'CATEGORY_UPDATES',
    'CATEGORY_FORUMS',
]);

/** Sender addresses that do not read replies. */
const NO_REPLY_SENDER = /(^|[<\s"])(no-?reply|do-?not-?reply|notifications?|mailer-daemon|postmaster)@/i;

const DAY_MS = 24 * 60 * 60 * 1000;

const REASONS = {
    'no-reply-needed': 'Automated or bulk mail',
    answered: 'You replied last',
    'follow-up': 'From a person, and you have not replied',
};

function headerValue(headers, name) {
    const wanted = name.toLowerCase();
    const found = (headers || []).find(h => String(h.name).toLowerCase() === wanted);
    return found ? String(found.value || '') : '';
}

/** True when the message is bulk or machine-sent mail that nobody expects you to answer. */
function isAutomated(headers, labelIds) {
    if ((labelIds || []).some(label => BULK_CATEGORIES.has(label))) return true;
    if (headerValue(headers, 'List-Unsubscribe')) return true;
    const autoSubmitted = headerValue(headers, 'Auto-Submitted').trim().toLowerCase();
    if (autoSubmitted && autoSubmitted !== 'no') return true;
    if (/^(bulk|list|junk)$/i.test(headerValue(headers, 'Precedence').trim())) return true;
    return NO_REPLY_SENDER.test(headerValue(headers, 'From'));
}

/** Whole days since the message arrived; null when the date cannot be read. */
function ageInDays(date, now) {
    const arrived = new Date(date);
    if (Number.isNaN(arrived.getTime())) return null;
    return Math.max(0, Math.floor((now.getTime() - arrived.getTime()) / DAY_MS));
}

/**
 * The advice shown under a message: 'no-reply-needed', 'answered', 'follow-up' or null.
 *
 * repliedByMe is true when you wrote the conversation's last message, false when
 * you did not, and null when that could not be checked. An unchecked reply never
 * earns "Follow up", because advice that may be wrong is worse than none.
 */
function adviseFollowUp({ date, automated, repliedByMe, now = new Date() }) {
    const ageDays = ageInDays(date, now);
    let advice = null;
    if (automated) {
        advice = 'no-reply-needed';
    } else if (repliedByMe === true) {
        advice = 'answered';
    } else if (repliedByMe === false && ageDays !== null && ageDays >= FOLLOW_UP_AFTER_DAYS) {
        advice = 'follow-up';
    }
    return { ageDays, advice, reason: advice ? REASONS[advice] : '' };
}

/** True when the conversation's newest message is one you sent (Gmail lists them oldest first). */
function lastMessageIsMine(threadMessages) {
    const messages = threadMessages || [];
    const last = messages[messages.length - 1];
    return Boolean(last && (last.labelIds || []).includes('SENT'));
}

/** When Gmail received the message, as an ISO string; falls back to the Date header. */
function receivedAt(internalDate, dateHeader) {
    const ms = Number(internalDate);
    if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
    const parsed = new Date(dateHeader);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

/** Newest first, with unreadable dates last. */
function newestFirst(a, b) {
    return (Date.parse(b.receivedAt) || 0) - (Date.parse(a.receivedAt) || 0);
}

module.exports = {
    FOLLOW_UP_AFTER_DAYS,
    isAutomated,
    ageInDays,
    adviseFollowUp,
    lastMessageIsMine,
    receivedAt,
    newestFirst,
};
