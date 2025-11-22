'use client';

import { useState } from 'react';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

function MenuItem({ icon, label, isActive, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        isActive
          ? 'bg-gray-50 text-zinc-900 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-zinc-900'
      }`}
    >
      <span className={isActive ? 'text-zinc-900' : 'text-gray-500'}>{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {children}
    </div>
  );
}

interface LeftMenuPanelProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
}

export default function LeftMenuPanel({ activeItem = 'projects', onItemClick }: LeftMenuPanelProps) {
  const [currentActive, setCurrentActive] = useState(activeItem);

  const handleClick = (item: string) => {
    setCurrentActive(item);
    onItemClick?.(item);
  };

  return (
    <div className="h-full w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-gray-200">
        <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">ConstructAI</h1>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <SectionHeader>Main Menu</SectionHeader>
        <div className="px-2 space-y-1">
          <MenuItem
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            }
            label="Projects"
            isActive={currentActive === 'projects'}
            onClick={() => handleClick('projects')}
          />
          <MenuItem
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
            label="Users"
            isActive={currentActive === 'users'}
            onClick={() => handleClick('users')}
          />
          <MenuItem
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            label="Settings"
            isActive={currentActive === 'settings'}
            onClick={() => handleClick('settings')}
          />
        </div>
      </div>

      {/* Bottom Chat Section */}
      <div className="border-t border-gray-200 py-4">
        <div className="px-2">
          <MenuItem
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            label="Chat"
            isActive={currentActive === 'chat'}
            onClick={() => handleClick('chat')}
          />
        </div>

        {/* Version Info */}
        <div className="px-4 pt-4 mt-2 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-zinc-900">V2</span>
            </div>
            <div className="text-xs">
              <div className="font-semibold text-zinc-900">Design System</div>
              <div className="text-gray-500">v2.5.0 • Light Mode</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
