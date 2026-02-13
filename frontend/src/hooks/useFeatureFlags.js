/**
 * useFeatureFlags - Custom Hook for Feature Flag Management
 * Custom Hook สำหรับจัดการสวิตช์เปิด/ปิดฟีเจอร์
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook to check if a feature is enabled
 * 
 * Usage:
 * const isMonitoringEnabled = useFeature('monitoring_devices');
 * const isReportingEnabled = useFeature('reporting_pdf', { 
 *   userId: user.id, 
 *   projectId: project.id 
 * });
 */
export function useFeature(featureKey, options = {}) {
  const [enabled, setEnabled] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkFeature = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        
        if (options.userId) params.append('user_id', options.userId);
        if (options.projectId) params.append('project_id', options.projectId);

        const response = await api.get(
          `/api/admin/features/check/${featureKey}?${params}`
        );
        
        setEnabled(response.data?.enabled);
        setError(null);
      } catch (err) {
        setError(err.message);
        setEnabled(false); // Default to disabled on error
      } finally {
        setLoading(false);
      }
    };

    checkFeature();
  }, [featureKey, options.userId, options.projectId]);

  return { enabled, loading, error };
}

/**
 * Hook to check multiple features at once
 * 
 * Usage:
 * const features = useFeatures(['monitoring_devices', 'reporting_pdf'], {
 *   userId: user.id,
 *   projectId: project.id
 * });
 * 
 * if (features.loading) return <div>Loading...</div>;
 * if (features.monitoring_devices) { /* Show monitoring */ 

export function useFeatures(featureKeys, options = {}) {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkFeatures = async () => {
      try {
        setLoading(true);
        const response = await api.post('/api/admin/features/check-multiple', {
          features: featureKeys,
          user_id: options.userId,
          project_id: options.projectId
        });

        setFeatures(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
        // Set all to disabled on error
        const fallback = {};
        featureKeys.forEach(key => {
          fallback[key] = false;
        });
        setFeatures(fallback);
      } finally {
        setLoading(false);
      }
    };

    if (featureKeys && featureKeys.length > 0) {
      checkFeatures();
    }
  }, [featureKeys, options.userId, options.projectId]);

  return { ...features, loading, error };
}

/**
 * Hook to toggle a feature (Admin only)
 * 
 * Usage:
 * const { toggle, loading } = useToggleFeature('monitoring_devices');
 * const handleToggle = async () => {
 *   await toggle(true, 'Enabling for testing');
 * };
 */
export function useToggleFeature(featureKey) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = useCallback(async (enabled, reason = '') => {
    try {
      setLoading(true);
      await api.post('/api/admin/features/toggle', {
        feature_key: featureKey,
        enabled: enabled,
        scope: 'global',
        scope_id: 'default',
        reason: reason
      });
      
      setError(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [featureKey]);

  return { toggle, loading, error };
}

/**
 * Hook to toggle feature for specific project
 */
export function useToggleProjectFeature(projectId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = useCallback(async (featureKey, enabled, reason = '') => {
    try {
      setLoading(true);
      await api.post(`/api/admin/features/project/${projectId}/toggle`, {
        feature_key: featureKey,
        enabled: enabled,
        reason: reason
      });
      
      setError(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return { toggle, loading, error };
}

/**
 * Hook to toggle feature for specific user
 */
export function useToggleUserFeature(userId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = useCallback(async (featureKey, enabled, reason = '') => {
    try {
      setLoading(true);
      await api.post(`/api/admin/features/user/${userId}/toggle`, {
        feature_key: featureKey,
        enabled: enabled,
        reason: reason
      });
      
      setError(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { toggle, loading, error };
}

/**
 * Hook to toggle entire category
 */
export function useToggleCategory(scope = 'global', scopeId = 'default') {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = useCallback(async (category, enabled) => {
    try {
      setLoading(true);
      await api.post('/api/admin/features/toggle-category', {
        category: category,
        enabled: enabled,
        scope: scope,
        scope_id: scopeId
      });
      
      setError(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [scope, scopeId]);

  return { toggle, loading, error };
}

/**
 * Hook to get all features
 */
export function useAllFeatures() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/admin/features');
        setCategories(response.data?.categories || []);
        setError(null);
      } catch (err) {
        setError(err.message);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  return { categories, loading, error };
}

/**
 * Hook to get features for specific project
 */
export function useProjectFeatures(projectId) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/admin/features/project/${projectId}`);
        setCategories(response.data?.categories || []);
        setError(null);
      } catch (err) {
        setError(err.message);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [projectId]);

  return { categories, loading, error };
}

/**
 * Hook to get features for specific user
 */
export function useUserFeatures(userId) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/admin/features/user/${userId}`);
        setCategories(response.data?.categories || []);
        setError(null);
      } catch (err) {
        setError(err.message);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [userId]);

  return { categories, loading, error };
}

/**
 * Hook to get feature status with history
 */
export function useFeatureStatus(featureKey) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/admin/features/${featureKey}`);
        setStatus(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [featureKey]);

  return { status, loading, error };
}

/**
 * Example: Conditional Component Based on Features
 */
export function ConditionalFeature({ featureKey, children, fallback = null, options = {} }) {
  const { enabled, loading } = useFeature(featureKey, options);

  if (loading) return null;
  if (!enabled) return fallback;
  return children;
}

/**
 * Example: Feature Flag Guard for Routes
 */
export function FeatureGuardRoute({ featureKey, component: Component, fallback = null, ...rest }) {
  const { enabled, loading } = useFeature(featureKey);

  if (loading) return <div>Loading...</div>;
  if (!enabled) return fallback;
  return <Component {...rest} />;
}

export default {
  useFeature,
  useFeatures,
  useToggleFeature,
  useToggleProjectFeature,
  useToggleUserFeature,
  useToggleCategory,
  useAllFeatures,
  useProjectFeatures,
  useUserFeatures,
  useFeatureStatus,
  ConditionalFeature,
  FeatureGuardRoute
};
