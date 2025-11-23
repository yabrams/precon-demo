'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { LineItem } from './BidFormTable';
import ChatMessage from './ChatMessage';

interface ChatPanelProps {
  messages: ChatMessageType[];
  onSendMessage: (message: string) => void;
  onAcceptChanges: (messageId: string) => void;
  onRejectChanges: (messageId: string) => void;
  isLoading?: boolean;
  onClose?: () => void;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onAcceptChanges,
  onRejectChanges,
  isLoading = false,
  onClose,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect if the last message is a question from the assistant
  const lastMessage = messages[messages.length - 1];
  const isLastMessageQuestion =
    lastMessage?.role === 'assistant' &&
    !isLoading &&
    (lastMessage.content.includes('?') ||
     lastMessage.content.toLowerCase().includes('would you like') ||
     lastMessage.content.toLowerCase().includes('do you want') ||
     lastMessage.content.toLowerCase().includes('shall i') ||
     lastMessage.content.toLowerCase().includes('confirm'));

  // Extract numbered questions and pre-populate textarea
  useEffect(() => {
    if (!lastMessage || lastMessage.role !== 'assistant' || isLoading) return;

    // Check for numbered questions (1. 2. 3. etc)
    const numberedQuestionsRegex = /^\s*(\d+)\.\s+.+\?/gm;
    const matches = [...lastMessage.content.matchAll(numberedQuestionsRegex)];

    if (matches.length >= 2) {
      // Found multiple numbered questions - pre-populate with template
      const questionNumbers = matches.map(match => match[1]);
      const template = questionNumbers.map(num => `${num}. `).join('\n');
      setInputValue(template);

      // Focus textarea and position cursor at the end of first line
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const firstLineEnd = template.indexOf('\n') > 0 ? template.indexOf('\n') : template.length;
          inputRef.current.setSelectionRange(firstLineEnd, firstLineEnd);
        }
      }, 100);
    }
  }, [lastMessage, isLoading]);

  // Get quick reply suggestions based on the question
  const getQuickReplies = () => {
    if (!isLastMessageQuestion) return [];

    const content = lastMessage.content.toLowerCase();

    // Confirmation questions
    if (content.includes('proceed') || content.includes('confirm') || content.includes('would you like')) {
      return [
        { text: 'Yes, proceed', value: 'Yes, please proceed with this update.' },
        { text: 'No, cancel', value: 'No, please cancel this.' },
      ];
    }

    // General questions
    return [
      { text: 'Yes', value: 'Yes' },
      { text: 'No', value: 'No' },
    ];
  };

  const quickReplies = getQuickReplies();

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleQuickReply = (value: string) => {
    if (!isLoading) {
      onSendMessage(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full w-full bg-white border-l border-gray-200 overflow-hidden" style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900">AI Assistant</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-zinc-900 hover:bg-gray-100 transition-all"
              title="Minimize chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        className="overflow-y-auto px-5 py-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db #f9fafb'
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center text-center py-20">
            <div className="text-gray-600">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center shadow-sm">
                <svg className="w-9 h-9 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-2">
                Ask anything or request updates
              </p>
              <p className="text-xs text-gray-500">
                e.g., "What materials are shown?" or "Set all quantities to 1"
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onAcceptChanges={onAcceptChanges}
                onRejectChanges={onRejectChanges}
              />
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start mb-4"
              >
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3.5 shadow-sm animate-pulse">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-gray-50 px-5 py-4">
        {/* Quick Replies */}
        {quickReplies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 mb-3 flex-wrap"
          >
            <div className="text-xs text-gray-600 font-medium mb-1 w-full">Quick replies:</div>
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickReply(reply.value)}
                disabled={isLoading}
                className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-800 rounded-lg hover:bg-white hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
              >
                {reply.text}
              </button>
            ))}
          </motion.div>
        )}

        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or request an update..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:outline-none text-sm text-gray-900 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-600 shadow-sm transition-all"
            rows={3}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center self-end shadow-md disabled:shadow-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
