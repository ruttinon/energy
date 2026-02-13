import React, { useState, useEffect } from 'react';
import { ChevronDown, Plus, Edit2, Trash2, Search, Filter, AlertCircle, User, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MobileUserManagement = ({ projectId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user',
    email: '',
    phone: '',
    display_name: ''
  });
  
  const [selectedUser, setSelectedUser] = useState(null);

  const navigate = useNavigate();

  // Fetch users list
  useEffect(() => {
    fetchUsers();
  }, [projectId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/projects/${projectId}/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.status === 401) {
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(`Failed to load users: ${err.message}`);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Username and password are required');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/users/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          role: formData.role || 'user'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      setSuccess(`✅ User "${formData.username}" created successfully`);
      setShowAddModal(false);
      resetForm();
      
      // Refresh users list
      setTimeout(() => {
        fetchUsers();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(`Failed to create user: ${err.message}`);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/users/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          username: selectedUser,
          password: formData.password || undefined,
          role: formData.role || 'user'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      setSuccess(`✅ User "${selectedUser}" updated successfully`);
      setShowEditModal(false);
      resetForm();
      
      setTimeout(() => {
        fetchUsers();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(`Failed to update user: ${err.message}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      // Since we don't have a delete endpoint yet, we'll show a message
      setError('User deletion is not yet implemented. Please contact system administrator.');
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(`Failed to delete user: ${err.message}`);
    }
  };

  const openEditModal = (username) => {
    setSelectedUser(username);
    setFormData({
      username: username,
      password: '',
      role: 'user',
      email: '',
      phone: '',
      display_name: ''
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (username) => {
    setSelectedUser(username);
    setShowDeleteConfirm(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      role: 'user',
      email: '',
      phone: '',
      display_name: ''
    });
    setSelectedUser(null);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="w-full bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-900">👥 User Management</h1>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-lg shadow-yellow-500/20"
            >
              <Plus size={20} />
              Add User
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-900">Error</p>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="m-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">{success}</p>
        </div>
      )}

      {/* Users List */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
            <p className="text-slate-600 mt-4">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">No users found</p>
            <p className="text-slate-400 text-sm mt-1">Add your first user to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((username) => (
              <div
                key={username}
                className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{username}</h3>
                  <p className="text-sm text-slate-500">User · Project member</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(username)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit user"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(username)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete user"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Add New User</h2>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Enter password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="user">User (Basic access)</option>
                  <option value="manager">Manager (Advanced features)</option>
                  <option value="admin">Admin (Full access)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="+66 XX XXX XXXX"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold py-3 rounded-lg transition shadow-lg shadow-yellow-500/20"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Edit User</h2>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Username (Read-only)
                </label>
                <input
                  type="text"
                  value={selectedUser}
                  disabled
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  New Password (Leave empty to keep current)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Enter new password or leave blank"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="user">User (Basic access)</option>
                  <option value="manager">Manager (Advanced features)</option>
                  <option value="admin">Admin (Full access)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold py-3 rounded-lg transition shadow-lg shadow-yellow-500/20"
                >
                  Update User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">⚠️ Delete User?</h2>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete user "{selectedUser}"? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleDeleteUser}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg transition"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  resetForm();
                }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileUserManagement;
