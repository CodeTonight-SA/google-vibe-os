import { ageText, ageTone } from '../mail-age';

// The theme's brand orange, and the red the stylesheet already uses for errors (it has no token).
const TONE_COLOURS = { fresh: 'var(--text-muted)', aging: 'var(--accent-brand)', old: '#dc2626' };

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
                <span style={{ color: email.advice === 'follow-up' ? TONE_COLOURS.aging : TONE_COLOURS.fresh }}>
                    {label}{email.adviceReason ? `: ${email.adviceReason}` : ''}
                </span>
            )}
        </div>
    );
}
