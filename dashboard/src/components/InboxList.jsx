import { formatWhen, senderName } from '../mail-age';
import MailAgeLine from './MailAgeLine';

/** The inbox rows: who sent it, when it arrived, the subject, and its age and advice. */
export default function InboxList({ emails, onOpen }) {
    return emails.map(email => (
        <div key={email.id} className="list-item" onClick={() => onOpen(email)}>
            <div className="list-content">
                <div className="item-title" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: email.unread ? 700 : 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {email.unread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
                        {senderName(email.from)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'ui-monospace, "SF Mono", monospace', fontWeight: 400 }}>
                        {formatWhen(email.receivedAt || email.date)}
                    </span>
                </div>
                <div className="item-sub" style={{ fontWeight: email.unread ? 600 : 400 }}>{email.subject}</div>
                <MailAgeLine email={email} />
            </div>
        </div>
    ));
}
