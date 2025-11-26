'use client';

/**
 * User Management Page
 * Admin and Precon Lead only
 * Manage users: view, create, edit, deactivate, reset passwords
 */

import { useState, useEffect } from 'react';
import { UserRole, UserRoleLabels, UserPublic, UserCreateInput, UserUpdateInput } from '@/types/user';
import AddUserModal from '@/components/admin/AddUserModal';
import EditUserModal from '@/components/admin/EditUserModal';
import DeleteUserDialog from '@/components/admin/DeleteUserDialog';
import ResetPasswordDialog from '@/components/admin/ResetPasswordDialog';
import TempPasswordDialog from '@/components/admin/TempPasswordDialog';

// Role badge colors
const RoleBadgeColors: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'bg-red-50 text-red-700 border-red-200',
  [UserRole.PRECON_LEAD]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [UserRole.SCOPE_CAPTAIN]: 'bg-amber-50 text-amber-700 border-amber-200',
  [UserRole.PRECON_ANALYST]: 'bg-zinc-50 text-zinc-600 border-zinc-200',
};

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserPublic | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Fetch current user and check permissions
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          window.location.href = '/login'; // Redirect to login if not authenticated
          return;
        }
        const { user } = await response.json();

        // Check if user can manage users (Admin or Precon Lead)
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.PRECON_LEAD) {
          window.location.href = '/'; // Redirect if insufficient permissions
          return;
        }

        setCurrentUser(user);
      } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
      }
    }
    checkAuth();
  }, []);

  // Fetch users
  useEffect(() => {
    if (!currentUser) return;

    async function fetchUsers() {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const { users: fetchedUsers } = await response.json();
          setUsers(fetchedUsers);
          setFilteredUsers(fetchedUsers);
        } else {
          console.error('Failed to fetch users');
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [currentUser]);

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
        // Show temp password modal
      } else {
        const { error } = await response.json();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    }
  };

  const handleEditUser = async (userId: string, updates: UserUpdateInput) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const { user } = await response.json();
        setUsers(users.map((u) => (u.id === userId ? user : u)));
        setShowEditModal(false);
        setSelectedUser(null);
      } else {
        const { error } = await response.json();
        alert(`Error: ${error}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
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

  if (!currentUser || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage system users and permissions</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium"
          >
            + Add User
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by name, email, or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400"
              >
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="all">All Users</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 font-semibold">
                        {user.firstName?.[0] || user.userName[0].toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.userName}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.userName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        RoleBadgeColors[user.role]
                      }`}
                    >
                      {UserRoleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowEditModal(true);
                      }}
                      className="text-zinc-600 hover:text-zinc-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowResetPasswordDialog(true);
                      }}
                      className="text-orange-600 hover:text-orange-900"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDeleteDialog(true);
                      }}
                      className="text-red-600 hover:text-red-900"
                      disabled={user.id === currentUser.id}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No users found matching your filters.
            </div>
          )}
        </div>

        {/* Modals */}
        <AddUserModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddUser}
        />

        <EditUserModal
          isOpen={showEditModal}
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSubmit={handleEditUser}
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
    </div>
  );
}
