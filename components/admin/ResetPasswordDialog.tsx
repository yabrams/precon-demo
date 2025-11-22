'use client';

/**
 * Reset Password Dialog
 * Confirms password reset action and displays temporary password
 */

import { motion, AnimatePresence } from 'framer-motion';
import { UserPublic } from '@/types/user';

interface ResetPasswordDialogProps {
  isOpen: boolean;
  user: UserPublic | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function ResetPasswordDialog({
  isOpen,
  user,
  onClose,
  onConfirm,
}: ResetPasswordDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  if (!user) return null;

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
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-orange-100 rounded-full mb-4">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Reset Password
              </h3>

              <p className="text-sm text-gray-600 text-center mb-6">
                Are you sure you want to reset the password for{' '}
                <span className="font-semibold">{user.userName}</span>?
              </p>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-orange-800">
                  This will:
                </p>
                <ul className="list-disc list-inside text-sm text-orange-800 mt-2 space-y-1">
                  <li>Generate a new temporary password</li>
                  <li>Require the user to change password on next login</li>
                  <li>Log out the user from all active sessions</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
