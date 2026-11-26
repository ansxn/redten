'use client';

import PixelIcon from '@/components/PixelIcon';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export default function EmptyState({
    icon = <PixelIcon name="cards" size={40} />,
    title,
    description,
    action,
}: EmptyStateProps) {
    return (
        <div
            className="text-center animate-fade-in"
            style={{ padding: 'var(--space-3xl) var(--space-lg)' }}
        >
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
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
