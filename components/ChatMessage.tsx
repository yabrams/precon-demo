'use client';

import { ChatMessage as ChatMessageType } from '@/types/chat';
import { motion } from 'framer-motion';

interface ChatMessageProps {
  message: ChatMessageType;
  onAcceptChanges?: (messageId: string) => void;
  onRejectChanges?: (messageId: string) => void;
}

// Helper function to parse markdown bold syntax (**text**)
function parseMarkdownBold(text: string) {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add bold text
    parts.push(
      <strong key={match.index} className="font-bold">
        {match[1]}
      </strong>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function ChatMessage({ message, onAcceptChanges, onRejectChanges }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasProposedChanges = message.proposedChanges && message.proposedChanges.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isUser
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
              : 'bg-white border border-slate-200 text-slate-900'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{parseMarkdownBold(message.content)}</p>
        </div>

        {/* Proposed changes card */}
        {hasProposedChanges && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ delay: 0.2 }}
            className="mt-3 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-sm">Proposed Changes ({message.proposedChanges?.length})</span>
              </h4>
            </div>

            <div className="space-y-2 mb-4">
              {message.proposedChanges?.map((change, idx) => (
                <div key={idx} className="text-sm text-slate-700 bg-white/60 rounded-lg px-3 py-2.5">
                  <div className="flex items-start gap-2.5 mb-1.5">
                    <span className={`font-bold text-xs px-2 py-0.5 rounded-md flex-shrink-0 ${
                      change.type === 'add' ? 'bg-emerald-100 text-emerald-700' :
                      change.type === 'delete' ? 'bg-rose-100 text-rose-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {change.type === 'add' ? '+ ADD' :
                       change.type === 'delete' ? '- DEL' :
                       '✏ EDIT'}
                    </span>
                    <span className="flex-1 font-medium">
                      {change.type === 'add' && change.newItem?.description}
                      {change.type === 'delete' && `Delete: ${change.itemId}`}
                      {change.type === 'update' && (change.newItem?.description || `Item ${change.itemId}`)}
                    </span>
                  </div>

                  {/* Show details for ADD operations */}
                  {change.type === 'add' && change.newItem && (
                    <div className="ml-7 space-y-1">
                      {change.newItem.item_number && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Item #:</span>{' '}
                          <span className="font-semibold text-emerald-700">{change.newItem.item_number}</span>
                        </div>
                      )}
                      {change.newItem.quantity != null && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Quantity:</span>{' '}
                          <span className="font-semibold text-emerald-700">{change.newItem.quantity}</span>
                        </div>
                      )}
                      {change.newItem.unit && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Unit:</span>{' '}
                          <span className="font-semibold text-emerald-700">{change.newItem.unit}</span>
                        </div>
                      )}
                      {change.newItem.unit_price != null && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Unit Price:</span>{' '}
                          <span className="font-semibold text-emerald-700">${change.newItem.unit_price}</span>
                        </div>
                      )}
                      {change.newItem.total_price != null && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Total Price:</span>{' '}
                          <span className="font-semibold text-emerald-700">${change.newItem.total_price}</span>
                        </div>
                      )}
                      {change.newItem.notes && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Notes:</span>{' '}
                          <span className="font-semibold text-emerald-700">{change.newItem.notes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show details for UPDATE operations */}
                  {change.type === 'update' && change.changes && change.changes.length > 0 && (
                    <div className="ml-7 space-y-1">
                      {change.changes.map((fieldChange, fIdx) => (
                        <div key={fIdx} className="text-xs text-slate-600">
                          <span className="font-medium">{fieldChange.field}:</span>{' '}
                          <span className="line-through text-slate-400">{String(fieldChange.oldValue ?? 'N/A')}</span>
                          {' → '}
                          <span className="font-semibold text-emerald-700">{String(fieldChange.newValue ?? 'N/A')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Accept clicked for message:', message.id);
                  if (onAcceptChanges) {
                    onAcceptChanges(message.id);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all font-semibold text-sm shadow-lg shadow-emerald-500/30"
              >
                Accept Changes
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Reject clicked for message:', message.id);
                  if (onRejectChanges) {
                    onRejectChanges(message.id);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all font-semibold text-sm"
              >
                Reject
              </button>
            </div>
          </motion.div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-slate-400 mt-1.5 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}
