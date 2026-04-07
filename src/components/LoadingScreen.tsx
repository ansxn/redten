'use client';

export default function LoadingScreen() {
    return (
        <div className="min-h-screen flex-center" style={{ flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Pulsing logo placeholder */}
            <div
                className="skeleton"
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-full)',
                }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <div className="skeleton skeleton-title" style={{ width: 120 }} />
                <div className="skeleton skeleton-text" style={{ width: 80 }} />
            </div>
        </div>
    );
}
