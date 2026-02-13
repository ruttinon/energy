/**
 * Authenticated Fetch Helper
 * จัดการ API calls ที่ต้อง Authentication
 */

import api from './api';

/**
 * Get auth headers for API calls
 * ดึง headers สำหรับการขอ API
 */
export function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Prefer sessionStorage (tab-isolated) then fallback to localStorage
  const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Authenticated fetch wrapper
 * Fetch ที่รวม authentication
 * 
 * Usage:
 * const response = await authFetch('/api/projects/123/info');
 */
export async function authFetch(url, options = {}) {
  const finalOptions = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: 'include', // Include cookies
  };

  const response = await fetch(url, finalOptions);

  // Handle 401 - redirect to login
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('selectedProject');
    localStorage.removeItem('selectedDevice');
    sessionStorage.clear();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return response;
}

/**
 * Wrapper for common API calls with auth
 */
export async function fetchWithAuth(endpoint, options = {}) {
  const response = await authFetch(endpoint, options);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get project info with auth
 */
export async function getProjectInfo(projectId) {
  try {
    return await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/info`);
  } catch (err) {
    console.error('Failed to get project info:', err);
    return null;
  }
}

/**
 * Get ingest token with auth
 */
export async function getIngestToken(projectId) {
  try {
    return await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/ingest_token`);
  } catch (err) {
    console.error('Failed to get ingest token:', err);
    return null;
  }
}

/**
 * Get project users with auth
 */
export async function getProjectUsers(projectId) {
  try {
    return await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/users`);
  } catch (err) {
    console.error('Failed to get project users:', err);
    return null;
  }
}

/**
 * Get PowerStudio status with auth
 */
export async function getPowerStudioStatus() {
  try {
    const baseUrl = window.location.origin;
    return await fetchWithAuth(`${baseUrl}/api/powerstudio/status`);
  } catch (err) {
    console.error('Failed to get PowerStudio status:', err);
    return { connected: false, error: String(err) };
  }
}

/**
 * Get extension commands list with auth
 */
export async function getExtensionCommands(deviceId) {
  try {
    const baseUrl = window.location.origin;
    return await fetchWithAuth(`${baseUrl}/api/extension/commands/list?device_id=${encodeURIComponent(deviceId)}`);
  } catch (err) {
    console.error('Failed to get extension commands:', err);
    return { commands: [] };
  }
}

export default {
  getAuthHeaders,
  authFetch,
  fetchWithAuth,
  getProjectInfo,
  getIngestToken,
  getProjectUsers,
  getPowerStudioStatus,
  getExtensionCommands,
};
