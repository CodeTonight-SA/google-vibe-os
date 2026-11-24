import { ageText, ageTone } from '../mail-age';

const TONE_COLOURS = { fresh: 'var(--text-muted)', aging: '#b45309', old: '#b91c1c' };

const ADVICE_LABELS = {
    'follow-up': 'Follow up',
    'no-reply-needed': 'No reply needed',
    answered: 'Answered',
};

/** A message's age, and the follow-up advice when the main process gave one. */
export default function MailAgeLine({ email }) {
    const when = email.receivedAt || email.date;
    const age = ageText(when);
    const label = ADVICE_LABELS[email.advice];
    if (!age && !label) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', marginTop: 4, fontSize: '0.75rem' }}>
            {age && <span style={{ color: TONE_COLOURS[ageTone(when)], fontWeight: 600 }}>{age}</span>}
            {label && (
                <span style={{ color: email.advice === 'follow-up' ? '#b45309' : 'var(--text-muted)' }}>
                    {label}{email.adviceReason ? `: ${email.adviceReason}` : ''}
                </span>
            )}
        </div>
    );
}
