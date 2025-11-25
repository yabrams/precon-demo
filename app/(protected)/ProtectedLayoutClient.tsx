'use client';

/**
 * Protected Layout Client Component
 * Handles the interactive layout with sidebar, header, and animations
 */

import { useState, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LeftMenuPanel from '@/components/LeftMenuPanel';
import Avatar from '@/components/Avatar';
import RouteBreadcrumbs from '@/components/RouteBreadcrumbs';
import { useAuth } from '@/hooks/useAuth';
import { UserPublic } from '@/types/user';

interface ProtectedLayoutClientProps {
  children: ReactNode;
  user: UserPublic;
}

export default function ProtectedLayoutClient({ children, user }: ProtectedLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (userMenuOpen && !target.closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Handle clicks outside the sidebar to minimize it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.left-menu-panel')) {
        setSidebarCollapsed(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Determine active menu item from pathname
  const getActiveMenuItem = (): string => {
    if (pathname.startsWith('/admin/users') || pathname === '/users') return 'users';
    if (pathname.startsWith('/csi')) return 'csi';
    return 'projects';
  };

  // Handle menu item clicks - navigate to routes
  const handleMenuItemClick = (item: string) => {
    switch (item) {
      case 'projects':
        router.push('/');
        break;
      case 'users':
        router.push('/admin/users');
        break;
      case 'csi':
        router.push('/csi');
        break;
      case 'settings':
        // TODO: Add settings page
        break;
      default:
        break;
    }
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Menu Panel */}
      <LeftMenuPanel
        activeItem={getActiveMenuItem()}
        onItemClick={handleMenuItemClick}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole={user?.role}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-10 h-[68px]">
          <div className="px-6 h-full flex items-center justify-between">
            {/* Breadcrumbs */}
            <RouteBreadcrumbs />

            {/* User Menu */}
            <div className="flex items-center">
              <div className="relative user-menu-container">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                >
                  <Avatar
                    firstName={user.firstName}
                    lastName={user.lastName}
                    avatarUrl={user.avatarUrl}
                    size="medium"
                  />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-semibold text-zinc-900">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.userName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {user.email}
                      </p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-zinc-900 transition-colors flex items-center space-x-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 min-h-0">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
