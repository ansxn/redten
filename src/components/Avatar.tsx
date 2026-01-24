'use client';

import { useState, useEffect } from 'react';
import { getAvatarUrl } from '@/lib/avatar';

interface AvatarProps {
    userId?: string;  // If provided, will try to fetch avatar image
    username: string;
    avatarColor: string;
    size?: number;
    fontSize?: string;
}

/**
 * Reusable Avatar component that displays user's uploaded avatar image
 * or falls back to colored circle with initial
 */
export default function Avatar({
    userId,
    username,
    avatarColor,
    size = 40,
    fontSize = '1rem'
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

    return (
        <div
            className="player-avatar"
            style={{
                width: size,
                height: size,
                fontSize,
                background: avatarUrl
                    ? `url(${avatarUrl}) center/cover`
                    : avatarColor || 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-red) 100%)'
            }}
        >
            {!avatarUrl && username.charAt(0).toUpperCase()}
        </div>
    );
}
