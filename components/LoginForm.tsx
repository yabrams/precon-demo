'use client';

/**
 * Login Form Component
 * Allows users to authenticate with email and password
 */

import { useState } from 'react';
import { UserLoginInput } from '@/types/user';

interface LoginFormProps {
  onSuccess: (user: any, token: string) => void;
  onSwitchToRegister?: () => void;
}

export default function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [formData, setFormData] = useState<UserLoginInput>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Call success callback with user and token
      onSuccess(data.user, data.token);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-8 hover:border-zinc-300 hover:shadow-md transition-all duration-300">
      <h2 className="text-2xl font-bold text-zinc-900 mb-6">Sign In</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-900 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500 text-sm text-zinc-900 placeholder:text-gray-400 transition-all duration-200"
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-900 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500 text-sm text-zinc-900 placeholder:text-gray-400 transition-all duration-200"
            placeholder="••••••••"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-2 px-4 rounded-lg shadow-md shadow-zinc-900/10 transition-all duration-200 disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {onSwitchToRegister && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-zinc-900 hover:text-zinc-800 font-semibold underline transition-colors duration-200"
            >
              Create Account
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
