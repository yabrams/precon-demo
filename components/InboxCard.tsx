'use client';

import { InboxItem } from '@/types/inbox';
import { motion } from 'framer-motion';

interface InboxCardProps {
  item: InboxItem;
  onClick: (item: InboxItem) => void;
}

export default function InboxCard({ item, onClick }: InboxCardProps) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      bgColor: 'bg-zinc-50',
      textColor: 'text-zinc-800',
      dotColor: 'bg-zinc-500',
    },
    in_progress: {
      label: 'In Progress',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      dotColor: 'bg-amber-500',
    },
    completed: {
      label: 'Completed',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
    },
  };

  const config = statusConfig[item.status];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <motion.button
      onClick={() => onClick(item)}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="w-full bg-white rounded-xl border-2 border-gray-200 hover:border-zinc-300 hover:shadow-md transition-all p-4 text-left group"
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          <img
            src={item.diagramUrl}
            alt={item.subject}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header with status */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-zinc-900 transition-colors">
              {item.subject}
            </h3>
            <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`}></span>
              {config.label}
            </span>
          </div>

          {/* Sender */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {item.sender.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-700 truncate">{item.sender}</p>
              <p className="text-xs text-gray-500 truncate">{item.senderEmail}</p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Received {formatDate(item.receivedAt)}</span>
          </div>
        </div>
      </div>

      {/* Hover indicator */}
      <div className="mt-3 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 text-sm text-zinc-900 font-medium">
          <span>View and process</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </motion.button>
  );
}
