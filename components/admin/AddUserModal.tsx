'use client';

/**
 * Add User Modal
 * Form for creating new users (Admin/Precon Lead only)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserRole, UserRoleLabels, UserCreateInput } from '@/types/user';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: UserCreateInput) => Promise<void>;
}

export default function AddUserModal({ isOpen, onClose, onSubmit }: AddUserModalProps) {
  const [formData, setFormData] = useState<UserCreateInput>({
    email: '',
    userName: '',
    firstName: '',
    lastName: '',
    role: UserRole.PRECON_ANALYST,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        email: '',
        userName: '',
        firstName: '',
        lastName: '',
        role: UserRole.PRECON_ANALYST,
      });
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-zinc-900 mb-6">Add New User</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                    placeholder="user@example.com"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                    placeholder="username"
                  />
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName || ''}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                    placeholder="John"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName || ''}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                    placeholder="Doe"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Role *
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                  >
                    {Object.entries(UserRoleLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    A temporary password will be generated and shown after creation.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 text-sm font-medium shadow-md shadow-zinc-900/10"
                  >
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
