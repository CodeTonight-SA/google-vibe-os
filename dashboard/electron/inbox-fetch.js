/**
 * Fetch the inbox for the dashboard: one metadata read per message, one
 * conversation read for a person's mail only, the advice from mail-advice.js,
 * and the list sorted newest first.
 *
 * The Gmail client and the logger are passed in, so the whole path is tested
 * with a fake client and no network.
 */
const mailAdvice = require('./mail-advice');

/** Whether you wrote the conversation's last message; null when it cannot be read. */
async function repliedByMeInThread(gmail, threadId, log) {
    try {
        const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'minimal' });
        return mailAdvice.lastMessageIsMine(thread.data.messages);
    } catch (e) {
        log.warn('Could not read the conversation to check for a reply', e?.message);
        return null;
    }
}

async function fetchInboxItem(gmail, msg, log, now = new Date()) {
    const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata' });
    const headers = detail.data.payload?.headers || [];
    const labelIds = detail.data.labelIds || [];
    const date = mailAdvice.headerValue(headers, 'Date');
    const automated = mailAdvice.isAutomated(headers, labelIds);
    // Bulk mail never needs the conversation check, so it costs no extra call.
    const repliedByMe = automated ? false : await repliedByMeInThread(gmail, msg.threadId, log);
    const arrived = mailAdvice.receivedAt(detail.data.internalDate, date);
    const { ageDays, advice, reason } = mailAdvice.adviseFollowUp({ date: arrived, automated, repliedByMe, now });
    return {
        id: msg.id,
        threadId: msg.threadId,
        subject: mailAdvice.headerValue(headers, 'Subject') || 'No Subject',
        from: mailAdvice.headerValue(headers, 'From') || 'Unknown',
        date,
        receivedAt: arrived,
        ageDays,
        snippet: detail.data.snippet,
        unread: labelIds.includes('UNREAD'),
        advice,
        adviceReason: reason,
    };
}

/** The newest inbox messages with their age and advice, newest first. */
async function fetchInbox(gmail, maxResults, log, now = new Date()) {
    const res = await gmail.users.messages.list({ userId: 'me', maxResults, labelIds: ['INBOX'] });
    const messages = res.data.messages || [];
    // Collect the results in place, then sort, so the list never follows the
    // order in which the fetches happened to finish.
    const items = await Promise.all(messages.map(async (msg) => {
        try {
            return await fetchInboxItem(gmail, msg, log, now);
        } catch (e) {
            log.error('Error fetching email details', e);
            return null;
        }
    }));
    return items.filter(Boolean).sort(mailAdvice.newestFirst);
}

module.exports = { fetchInbox, fetchInboxItem, repliedByMeInThread };
