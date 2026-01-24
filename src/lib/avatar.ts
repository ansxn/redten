/**
 * Avatar Upload Service
 * Handles profile picture uploads to Supabase Storage
 */

import { createClient } from './supabase';

const supabase = createClient();
const BUCKET_NAME = 'avatars';

export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

export async function uploadAvatar(userId: string, file: File): Promise<UploadResult> {
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        return { success: false, error: 'Invalid file type. Please use JPEG, PNG, GIF, or WebP.' };
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
        return { success: false, error: 'File too large. Maximum size is 2MB.' };
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    try {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file, {
                upsert: true,  // Overwrite existing
                cacheControl: '3600'
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return { success: false, error: uploadError.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        const avatarUrl = urlData.publicUrl;

        // Update profile with new avatar URL
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (updateError) {
            console.error('Profile update error:', updateError);
            return { success: false, error: 'Failed to update profile' };
        }

        return { success: true, url: avatarUrl };
    } catch (e) {
        console.error('Avatar upload failed:', e);
        return { success: false, error: 'Upload failed. Please try again.' };
    }
}

export async function getAvatarUrl(userId: string): Promise<string | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();

    if (error || !data) return null;
    return data.avatar_url;
}
