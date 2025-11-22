'use client';

/**
 * Temporary Password Dialog
 * Displays the temporary password after user creation or password reset
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TempPasswordDialogProps {
  isOpen: boolean;
  password: string | null;
  userName?: string;
  onClose: () => void;
}

export default function TempPasswordDialog({
  isOpen,
  password,
  userName,
  onClose,
}: TempPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (password) {
      navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!password) return null;

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
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Temporary Password Generated
              </h3>

              {userName && (
                <p className="text-sm text-gray-600 text-center mb-4">
                  For user: <span className="font-semibold">{userName}</span>
                </p>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <code className="text-lg font-mono font-semibold text-gray-900">
                    {password}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                <div className="flex">
                  <svg
                    className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Important!</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Copy this password now. It will not be shown again. The user will be required
                      to change it on their first login.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
