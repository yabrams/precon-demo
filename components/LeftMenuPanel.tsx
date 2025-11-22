'use client';

import { useState } from 'react';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}

function MenuItem({ icon, label, isActive, onClick, collapsed }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-md transition-all group relative ${
        isActive
          ? 'bg-gray-100 text-zinc-900 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-zinc-900'
      }`}
      title={collapsed ? label : undefined}
    >
      <span className={`${isActive ? 'text-zinc-900' : 'text-gray-500'} flex-shrink-0`}>{icon}</span>
      {!collapsed && <span className="text-[13px]">{label}</span>}

      {/* Tooltip on hover when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </button>
  );
}

function SectionHeader({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) {
  if (collapsed) return null;
  return (
    <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
      {children}
    </div>
  );
}

interface LeftMenuPanelProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function LeftMenuPanel({ activeItem = 'projects', onItemClick, collapsed = false, onToggleCollapse }: LeftMenuPanelProps) {
  const [currentActive, setCurrentActive] = useState(activeItem);

  const handleClick = (item: string) => {
    setCurrentActive(item);
    onItemClick?.(item);
  };

  const handleMouseEnter = () => {
    // When hovering over minimized menu, expand it and keep it expanded
    if (collapsed && onToggleCollapse) {
      onToggleCollapse();
    }
  };

  // Determine if menu should be visually expanded
  const isExpanded = !collapsed;

  return (
    <div
      className={`h-full bg-white border-r border-gray-200 flex flex-col overflow-x-hidden left-menu-panel ${isExpanded ? 'w-60' : 'w-16'}`}
      style={{
        transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseEnter={handleMouseEnter}
    >
      {/* Header */}
      <div className={`flex items-center gap-2.5 h-[68px] border-b border-gray-200 px-3`}>
        <div className="w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        {isExpanded && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold text-zinc-900 whitespace-nowrap">Cosmo</h1>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className="space-y-0.5 px-2">
          <MenuItem
            icon={
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            }
            label="Projects"
            isActive={currentActive === 'projects'}
            onClick={() => handleClick('projects')}
            collapsed={!isExpanded}
          />
          <MenuItem
            icon={
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
            label="Users"
            isActive={currentActive === 'users'}
            onClick={() => handleClick('users')}
            collapsed={!isExpanded}
          />
          <MenuItem
            icon={
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            label="Settings"
            isActive={currentActive === 'settings'}
            onClick={() => handleClick('settings')}
            collapsed={!isExpanded}
          />
        </div>
      </div>

      {/* Bottom Chat Section */}
      <div className="border-t border-gray-200 py-3 overflow-x-hidden">
        <div className="px-2">
          <MenuItem
            icon={
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            label="Chat"
            isActive={currentActive === 'chat'}
            onClick={() => handleClick('chat')}
            collapsed={!isExpanded}
          />
        </div>
      </div>

      {/* Bottom Account Info */}
      <div className="border-t border-gray-200 py-3 overflow-x-hidden">
        <div className="px-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center group relative">
              <span className="text-xs font-bold text-white">TC</span>
              {!isExpanded && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  Turner Construction
                </div>
              )}
            </div>
            {isExpanded && (
              <div className="text-[11px]">
                <div className="font-semibold text-zinc-900">Turner Construction</div>
                <div className="text-gray-500">Account</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
