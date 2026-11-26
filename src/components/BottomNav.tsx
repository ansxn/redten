'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PixelIcon, { PixelIconName } from '@/components/PixelIcon';

interface NavItem {
    href: string;
    label: string;
    icon: PixelIconName;
}

const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Home', icon: 'home' },
    { href: '/session/new', label: 'Play', icon: 'cards' },
    { href: '/groups', label: 'Groups', icon: 'users' },
    { href: '/friends', label: 'Friends', icon: 'userPlus' },
    { href: '/profile', label: 'Profile', icon: 'user' },
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
                            <PixelIcon name={item.icon} size={16} />
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
                            <span className="nav-icon"><PixelIcon name={item.icon} size={20} /></span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            )}
        </>
    );
}
