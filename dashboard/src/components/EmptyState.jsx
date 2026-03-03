/**
 * EmptyState - Swiss Nihilism styled empty state for dashboard widgets.
 * Shows an icon, primary message, and optional secondary hint/CTA.
 */
export default function EmptyState({ icon: Icon, iconColor = '#9ca3af', message, hint, action, actionLabel }) {
    return (
        <div className="empty-state">
            {Icon && <Icon size={28} color={iconColor} strokeWidth={1.5} />}
            <span className="empty-state-message">{message}</span>
            {hint && <span className="empty-state-hint">{hint}</span>}
            {action && actionLabel && (
                <button className="empty-state-action" onClick={action}>
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
