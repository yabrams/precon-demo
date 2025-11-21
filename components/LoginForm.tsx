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
    <div className="w-full max-w-md mx-auto bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl shadow-xl shadow-violet-900/10 p-8 hover:border-violet-500/50 transition-all duration-300">
      <h2 className="text-2xl font-bold text-white mb-6">Sign In</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
            Email Address
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
            Password
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white py-2 px-4 rounded-lg shadow-lg shadow-violet-900/20 transition-all duration-200 disabled:bg-violet-600/50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {onSwitchToRegister && (
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-violet-400 hover:text-violet-300 font-semibold underline transition-colors duration-200"
            >
              Create Account
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
