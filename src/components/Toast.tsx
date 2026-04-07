'use client';

interface ToastProps {
    message: { type: 'success' | 'error'; text: string } | null;
}

export default function Toast({ message }: ToastProps) {
    if (!message) return null;

    return (
        <div
            className={`toast ${message.type === 'success' ? 'toast-success' : 'toast-error'} animate-slide-up`}
            style={{ marginBottom: 'var(--space-xl)' }}
        >
            {message.text}
        </div>
    );
}
