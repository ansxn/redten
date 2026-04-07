'use client';

import { useState, useEffect } from 'react';
import { getAvatarUrl } from '@/lib/avatar';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
    userId?: string;
    username: string;
    avatarColor: string;
    size?: AvatarSize | number;
    fontSize?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
    sm: 'avatar-sm',
    md: '',        // default 40px from .player-avatar
    lg: 'avatar-lg',
    xl: 'avatar-xl',
};

/**
 * Reusable Avatar component that displays user's uploaded avatar image
 * or falls back to colored circle with initial.
 * Supports preset sizes (sm/md/lg/xl) or raw pixel values (min 28px).
 */
export default function Avatar({
    userId,
    username,
    avatarColor,
    size = 'md',
    fontSize,
}: AvatarProps) {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadAvatar = async () => {
            if (userId) {
                try {
                    const url = await getAvatarUrl(userId);
                    setAvatarUrl(url);
                } catch {
                    // Silently fail, use color fallback
                }
            }
        };
        loadAvatar();
    }, [userId]);

    // Handle preset vs number size
    const isPreset = typeof size === 'string';
    const sizeClass = isPreset ? sizeClasses[size] : '';
    const pixelSize = !isPreset ? Math.max(size, 28) : undefined; // minimum 28px

    return (
        <div
            className={`player-avatar ${sizeClass}`}
            style={{
                ...(pixelSize ? {
                    width: pixelSize,
                    height: pixelSize,
                    minWidth: pixelSize,
                    minHeight: pixelSize,
                } : {}),
                ...(fontSize ? { fontSize } : {}),
                background: avatarUrl
                    ? `url(${avatarUrl}) center/cover`
                    : avatarColor || 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-red) 100%)',
            }}
        >
            {!avatarUrl && username.charAt(0).toUpperCase()}
        </div>
    );
}
