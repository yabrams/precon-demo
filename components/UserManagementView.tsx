'use client';

/**
 * User Management View
 * Admin and Precon Lead only - embedded in main app
 * Manage users: view, create, edit, deactivate, reset passwords
 */

import { useState, useEffect } from 'react';
import { UserRole, UserRoleLabels, UserPublic, UserCreateInput, UserUpdateInput } from '@/types/user';
import AddUserModal from '@/components/admin/AddUserModal';
import DeleteUserDialog from '@/components/admin/DeleteUserDialog';
import ResetPasswordDialog from '@/components/admin/ResetPasswordDialog';
import TempPasswordDialog from '@/components/admin/TempPasswordDialog';

// Role badge colors - updated to match design system
const RoleBadgeColors: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'bg-zinc-100 text-zinc-800 border border-zinc-300',
  [UserRole.PRECON_LEAD]: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  [UserRole.SCOPE_CAPTAIN]: 'bg-zinc-50 text-zinc-700 border border-zinc-200',
  [UserRole.PRECON_ANALYST]: 'bg-gray-50 text-gray-700 border border-gray-200',
};

interface UserManagementViewProps {
  currentUser: UserPublic;
}

export default function UserManagementView({ currentUser }: UserManagementViewProps) {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  const resetFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('active');
  };

  const hasActiveFilters = searchQuery !== '' || roleFilter !== 'all' || statusFilter !== 'active';

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Inline editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');

  // Fetch users
  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const { users: fetchedUsers } = await response.json();
          setUsers(fetchedUsers);
          setFilteredUsers(fetchedUsers);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch users:', response.status, errorData);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.userName.toLowerCase().includes(query) ||
          user.firstName?.toLowerCase().includes(query) ||
          user.lastName?.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter((user) => user.isActive);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((user) => !user.isActive);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleAddUser = async (input: UserCreateInput) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const { user, tempPassword } = await response.json();
        setUsers([...users, user]);
        setTempPassword(tempPassword);
        setShowAddModal(false);
      } else {
        const { error } = await response.json();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    }
  };

  const startEditing = (userId: string, field: string, currentValue: string, currentLastName?: string) => {
    setEditingUserId(userId);
    setEditingField(field);
    setEditValue(currentValue || '');
    setEditLastName(currentLastName || '');
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setEditingField(null);
    setEditValue('');
    setEditLastName('');
  };

  const saveEdit = async (userId: string, field: string) => {
    try {
      const updates: Partial<UserUpdateInput> = field === 'name'
        ? {
            firstName: editValue,
            lastName: editLastName,
          }
        : {
            [field]: editValue,
          };

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const { user } = await response.json();
        setUsers(users.map((u) => (u.id === userId ? user : u)));
        cancelEditing();
      } else {
        const { error } = await response.json();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        const { user } = await response.json();
        setUsers(users.map((u) => (u.id === userId ? user : u)));
      } else {
        const { error } = await response.json();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const { user } = await response.json();
        setUsers(users.map((u) => (u.id === user.id ? user : u)));
        setShowDeleteDialog(false);
        setSelectedUser(null);
      } else {
        const { error } = await response.json();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
      });

      if (response.ok) {
        const { tempPassword } = await response.json();
        setTempPassword(tempPassword);
        setShowResetPasswordDialog(false);
        setSelectedUser(null);
      } else {
        const { error } = await response.json();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">User Management</h1>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-lg shadow-md shadow-zinc-900/10 transition-colors flex items-center"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add User</span>
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
            <div className="flex items-end justify-between gap-4 mb-4">
              <h3 className="text-sm font-semibold text-zinc-900">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs font-medium text-gray-600 hover:text-zinc-900 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset Filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Search by name, email, or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                >
                  <option value="all">All Roles</option>
                  {Object.entries(UserRoleLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                >
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="all">All Users</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const isEditing = editingUserId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                      {/* User Name & Avatar */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {user.firstName?.[0] || user.userName[0].toUpperCase()}
                          </div>
                          <div className="ml-4 min-w-0">
                            {isEditing && editingField === 'name' ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEdit(user.id, 'name');
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                    className="text-sm font-medium text-zinc-900 border border-zinc-300 rounded px-2 py-1 focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                                    placeholder="First Name"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={editLastName}
                                    onChange={(e) => setEditLastName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEdit(user.id, 'name');
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                    className="text-sm font-medium text-zinc-900 border border-zinc-300 rounded px-2 py-1 focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                                    placeholder="Last Name"
                                  />
                                  <button onClick={() => saveEdit(user.id, 'name')} className="text-emerald-600 hover:text-emerald-900 flex-shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <div className="text-sm text-gray-500 font-mono">{user.userName}</div>
                              </div>
                            ) : (
                              <div>
                                <div
                                  onClick={() => startEditing(user.id, 'name', user.firstName || '', user.lastName || '')}
                                  className="text-sm font-medium text-zinc-900 cursor-pointer hover:text-zinc-600 transition-colors"
                                  title="Click to edit name"
                                >
                                  {user.firstName && user.lastName
                                    ? `${user.firstName} ${user.lastName}`
                                    : user.userName}
                                </div>
                                <div className="text-sm text-gray-500 font-mono">{user.userName}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing && editingField === 'email' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="email"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(user.id, 'email');
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              className="text-sm text-zinc-900 border border-zinc-300 rounded px-2 py-1 focus:ring-2 focus:ring-zinc-500 focus:border-transparent w-full"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(user.id, 'email')} className="text-emerald-600 hover:text-emerald-900 flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditing(user.id, 'email', user.email)}
                            className="text-sm text-gray-600 cursor-pointer hover:text-zinc-900 transition-colors"
                            title="Click to edit email"
                          >
                            {user.email}
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                          className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full ${RoleBadgeColors[user.role]} border-0 cursor-pointer focus:ring-2 focus:ring-zinc-500`}
                        >
                          {Object.entries(UserRoleLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Last Login */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLoginAt ? (
                          <div className="font-mono">
                            <div>
                              {new Date(user.lastLoginAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(user.lastLoginAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        ) : (
                          'Never'
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Reset Password Icon */}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowResetPasswordDialog(true);
                            }}
                            className="relative group/tooltip p-2 text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Reset Password"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            <div className="absolute right-0 bottom-full mb-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                              Reset Password
                            </div>
                          </button>

                          {/* Activate/Deactivate Icon */}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteDialog(true);
                            }}
                            className={`relative group/tooltip p-2 rounded-lg transition-colors ${
                              user.id === currentUser.id
                                ? 'text-gray-300 cursor-not-allowed'
                                : user.isActive
                                ? 'text-gray-500 hover:text-red-700 hover:bg-red-50'
                                : 'text-gray-500 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            disabled={user.id === currentUser.id}
                            title={user.isActive ? 'Deactivate User' : 'Activate User'}
                          >
                            {user.isActive ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            {user.id !== currentUser.id && (
                              <div className="absolute right-0 bottom-full mb-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                {user.isActive ? 'Deactivate User' : 'Activate User'}
                              </div>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-zinc-900 mb-2">No Users Found</h3>
                <p className="text-gray-500">
                  No users match your current filters.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddUser}
      />

      <DeleteUserDialog
        isOpen={showDeleteDialog}
        user={selectedUser}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedUser(null);
        }}
        onConfirm={handleDeleteUser}
      />

      <ResetPasswordDialog
        isOpen={showResetPasswordDialog}
        user={selectedUser}
        onClose={() => {
          setShowResetPasswordDialog(false);
          setSelectedUser(null);
        }}
        onConfirm={handleResetPassword}
      />

      <TempPasswordDialog
        isOpen={!!tempPassword}
        password={tempPassword}
        userName={selectedUser?.userName}
        onClose={() => {
          setTempPassword(null);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
