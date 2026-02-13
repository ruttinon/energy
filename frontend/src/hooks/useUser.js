/**
 * useUser Hook - Provides user info and permissions
 * Usage: const { user, role, can, logout } = useUser();
 */

import { useState, useEffect, useContext, createContext } from 'react';
import api from '../services/api';
import { canAccessFeature, getAccessibleModules } from '../utils/userPermissions';

// Create User Context
const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await api.user.me();
      setUser(userData);
    } catch (e) {
      console.log('User not authenticated');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.user.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, logout, reloadUser: loadUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const { user, loading, logout, reloadUser } = useContext(UserContext);

  const can = (feature) => {
    if (!user) return false;
    return canAccessFeature(user.role, feature);
  };

  const canAny = (features) => {
    if (!user) return false;
    return features.some(f => canAccessFeature(user.role, f));
  };

  const canAll = (features) => {
    if (!user) return false;
    return features.every(f => canAccessFeature(user.role, f));
  };

  const getAccessibleModules = () => {
    if (!user) return [];
    return Object.keys(require('../utils/userPermissions').ROLE_PERMISSIONS[user.role] || {})
      .filter(key => require('../utils/userPermissions').ROLE_PERMISSIONS[user.role][key] === true);
  };

  return {
    user,
    loading,
    logout,
    reloadUser,
    can,          // can('dashboard')
    canAny,       // canAny(['admin_overview', 'device_manager'])
    canAll,       // canAll(['dashboard', 'alarms'])
    role: user?.role,
    username: user?.username,
    getAccessibleModules
  };
}
