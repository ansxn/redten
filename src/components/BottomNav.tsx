'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
    href: string;
    label: string;
    icon: string;
}

const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Home', icon: '🏠' },
    { href: '/session/new', label: 'Play', icon: '🃏' },
    { href: '/groups', label: 'Groups', icon: '👥' },
    { href: '/friends', label: 'Friends', icon: '🤝' },
    { href: '/profile', label: 'Profile', icon: '👤' },
];

interface BottomNavProps {
    /** 'desktop' = top nav only, 'mobile' = bottom bar only, 'both' = renders both */
    variant?: 'desktop' | 'mobile' | 'both';
}

export default function BottomNav({ variant = 'mobile' }: BottomNavProps) {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* Desktop top nav — renders inline wherever placed */}
            {(variant === 'desktop' || variant === 'both') && (
                <nav className="desktop-nav">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            )}

            {/* Mobile bottom tab bar — fixed at bottom */}
            {(variant === 'mobile' || variant === 'both') && (
                <nav className="bottom-nav">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            )}
        </>
    );
}
