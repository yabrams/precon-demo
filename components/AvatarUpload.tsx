'use client';

import React, { useState, useRef } from 'react';
import Avatar from './Avatar';

interface AvatarUploadProps {
  firstName?: string | null;
  lastName?: string | null;
  currentAvatarUrl?: string | null;
  onAvatarChange?: (avatarUrl: string) => void;
  size?: 'small' | 'medium' | 'large';
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  firstName,
  lastName,
  currentAvatarUrl,
  onAvatarChange,
  size = 'large',
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) return;

    const file = fileInputRef.current.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload avatar');
      }

      // Call the callback with the new avatar URL
      if (onAvatarChange) {
        onAvatarChange(data.avatarUrl);
      }

      setPreviewUrl(data.avatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
      setPreviewUrl(currentAvatarUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onAvatarChange) {
      onAvatarChange('');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar Preview */}
      <div className="relative">
        <Avatar
          firstName={firstName}
          lastName={lastName}
          avatarUrl={previewUrl}
          size={size}
        />
        {previewUrl && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
            title="Remove avatar"
          >
            ×
          </button>
        )}
      </div>

      {/* Upload Controls */}
      <div className="flex flex-col items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={triggerFileInput}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Choose Photo
          </button>

          {fileInputRef.current?.files?.[0] && !uploading && previewUrl !== currentAvatarUrl && (
            <button
              type="button"
              onClick={handleUpload}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
            >
              Upload
            </button>
          )}
        </div>

        {uploading && (
          <p className="text-sm text-gray-600">Uploading...</p>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <p className="text-xs text-gray-500 text-center">
          JPG, PNG or GIF. Max 5MB
        </p>
      </div>
    </div>
  );
};

export default AvatarUpload;
