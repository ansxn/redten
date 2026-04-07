'use client';

interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export default function EmptyState({
    icon = '🃏',
    title,
    description,
    action,
}: EmptyStateProps) {
    return (
        <div
            className="text-center animate-fade-in"
            style={{ padding: 'var(--space-3xl) var(--space-lg)' }}
        >
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)', opacity: 0.7 }}>
                {icon}
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                {title}
            </h3>
            {description && (
                <p className="text-dim" style={{ marginBottom: action ? 'var(--space-xl)' : undefined }}>
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}
