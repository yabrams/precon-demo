'use client';

/**
 * Registration Form Component
 * Allows new users to create an account
 */

import { useState } from 'react';
import { UserRegisterInput } from '@/types/user';

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
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

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
