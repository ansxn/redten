'use client';

import Link from 'next/link';

interface PageShellProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    backHref?: string;
    backLabel?: string;
    maxWidth?: 'sm' | 'md' | 'lg';
    /** Extra content rendered in the header area, e.g. action buttons */
    headerRight?: React.ReactNode;
    /** Whether to add bottom padding for the mobile nav bar */
    hasBottomNav?: boolean;
    /** Optional className on the outer main element */
    className?: string;
}

const maxWidthMap = {
    sm: '640px',
    md: '768px',
    lg: '1200px',
};

export default function PageShell({
    children,
    title,
    subtitle,
    backHref,
    backLabel = '← Back',
    maxWidth = 'lg',
    headerRight,
    hasBottomNav = false,
    className = '',
}: PageShellProps) {
    return (
        <main
            className={`min-h-screen p-4 md:p-8 ${hasBottomNav ? 'has-bottom-nav' : ''} ${className}`}
        >
            <div className="container" style={{ maxWidth: maxWidthMap[maxWidth] }}>
                {/* Header */}
                {(backHref || title) && (
                    <header className="mb-xl" style={{ marginBottom: 'var(--space-2xl)' }}>
                        {backHref && (
                            <Link href={backHref} className="btn btn-ghost mb-md" style={{ marginBottom: 'var(--space-md)', padding: '0.4rem 0.6rem', display: 'inline-flex' }}>
                                {backLabel}
                            </Link>
                        )}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                {title && <h1 className="text-title text-2xl md:text-3xl">{title}</h1>}
                                {subtitle && <p className="text-sub text-sm md:text-base" style={{ marginTop: 'var(--space-xs)' }}>{subtitle}</p>}
                            </div>
                            {headerRight && <div className="flex gap-sm flex-wrap">{headerRight}</div>}
                        </div>
                    </header>
                )}
                {children}
            </div>
        </main>
    );
}
