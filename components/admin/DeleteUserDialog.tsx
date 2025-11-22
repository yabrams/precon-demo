'use client';

/**
 * Delete User Dialog
 * Confirms user deactivation (soft delete)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { UserPublic } from '@/types/user';

interface DeleteUserDialogProps {
  isOpen: boolean;
  user: UserPublic | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteUserDialog({
  isOpen,
  user,
  onClose,
  onConfirm,
}: DeleteUserDialogProps) {
  if (!user) return null;

  const isDeactivating = user.isActive;

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

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div
                className={`flex items-center justify-center w-12 h-12 mx-auto ${
                  isDeactivating ? 'bg-red-100' : 'bg-green-100'
                } rounded-full mb-4`}
              >
                <svg
                  className={`w-6 h-6 ${isDeactivating ? 'text-red-600' : 'text-green-600'}`}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isDeactivating ? (
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  ) : (
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                {isDeactivating ? 'Deactivate User' : 'Activate User'}
              </h3>

              <p className="text-sm text-gray-600 text-center mb-6">
                Are you sure you want to {isDeactivating ? 'deactivate' : 'activate'}{' '}
                <span className="font-semibold">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.userName}
                </span>
                ?
              </p>

              {isDeactivating && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-red-800">
                    This will:
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-800 mt-2 space-y-1">
                    <li>Prevent the user from logging in</li>
                    <li>Log out the user from all active sessions</li>
                    <li>Keep the user data for audit purposes</li>
                    <li>Allow reactivation later if needed</li>
                  </ul>
                </div>
              )}

              {!isDeactivating && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-green-800">
                    This will restore the user's access to the system.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className={`px-4 py-2 ${
                    isDeactivating
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white rounded-lg transition-colors`}
                >
                  {isDeactivating ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
