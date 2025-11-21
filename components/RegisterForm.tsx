'use client';

/**
 * Registration Form Component
 * Allows new users to create an account
 */

import { useState } from 'react';
import { UserRegisterInput } from '@/types/user';
import Avatar from './Avatar';

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [formData, setFormData] = useState<UserRegisterInput>({
    email: '',
    userName: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setError('');
    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password match
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Register the user
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Step 2: Upload avatar if one was selected
      if (avatarFile && data.token) {
        try {
          const avatarFormData = new FormData();
          avatarFormData.append('file', avatarFile);

          await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.token}`,
            },
            body: avatarFormData,
          });
          // Note: We don't fail registration if avatar upload fails
        } catch (avatarError) {
          console.error('Avatar upload failed:', avatarError);
          // Continue anyway - user can upload avatar later
        }
      }

      // Call success callback
      onSuccess();
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl shadow-xl shadow-violet-900/10 p-8 hover:border-violet-500/50 transition-all duration-300">
      <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-1">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-200"
              placeholder="John"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-1">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-200"
              placeholder="Doe"
              disabled={loading}
            />
          </div>
        </div>

        {/* Avatar Upload Section */}
        <div className="flex flex-col items-center py-4 border-y border-slate-800">
          <label className="block text-sm font-medium text-slate-300 mb-3 text-center">
            Profile Picture (Optional)
          </label>

          <div className="relative">
            <Avatar
              firstName={formData.firstName}
              lastName={formData.lastName}
              avatarUrl={avatarPreview}
              size="large"
            />
            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={loading}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
                title="Remove avatar"
              >
                ×
              </button>
            )}
          </div>

          <input
            id="avatar"
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            disabled={loading}
            className="hidden"
          />

          <label
            htmlFor="avatar"
            className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Choose Photo
          </label>

          <p className="text-xs text-slate-500 mt-2 text-center">
            JPG, PNG or GIF. Max 5MB
          </p>
        </div>

        <div>
          <label htmlFor="userName" className="block text-sm font-medium text-slate-300 mb-1">
            Username <span className="text-red-400">*</span>
          </label>
          <input
            id="userName"
            type="text"
            required
            value={formData.userName}
            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
            className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-200"
            placeholder="johndoe"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-200"
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
            Password <span className="text-red-400">*</span>
          </label>
          <input
            id="password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-200"
            placeholder="••••••••"
            disabled={loading}
          />
          <p className="text-xs text-slate-500 mt-1">Must be at least 8 characters</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1">
            Confirm Password <span className="text-red-400">*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-200"
            placeholder="••••••••"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white py-2 px-4 rounded-lg shadow-lg shadow-violet-900/20 transition-all duration-200 disabled:bg-violet-600/50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      {onSwitchToLogin && (
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-violet-400 hover:text-violet-300 font-semibold underline transition-colors duration-200"
            >
              Sign In
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
