import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Toggle2, Lock } from 'lucide-react';
import api from '../../services/api';

/**
 * Feature Toggle Management Component
 * ส่วนประกอบสำหรับจัดการสวิตช์เปิด/ปิดฟีเจอร์
 * 
 * Features:
 * - Hierarchical category/feature structure
 * - Toggle per category, per feature, per project/user
 * - Real-time updates
 */

export default function FeatureToggle() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedScope, setSelectedScope] = useState('global');
  const [selectedProject, setSelectedProject] = useState('default');
  const [selectedUser, setSelectedUser] = useState('default');
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  // Load features on component mount
  useEffect(() => {
    loadFeatures();
    loadProjects();
    loadUsers();
  }, [selectedScope]);

  // Reload when scope changes
  useEffect(() => {
    loadFeatures();
  }, [selectedScope, selectedProject, selectedUser]);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      let response;

      if (selectedScope === 'global') {
        response = await api.get('/admin/features');
      } else if (selectedScope === 'project') {
        response = await api.get(`/admin/features/project/${selectedProject}`);
      } else if (selectedScope === 'user') {
        response = await api.get(`/admin/features/user/${selectedUser}`);
      }

      setFeatures(response.data?.categories || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading features:', error);
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await api.get('/admin/projects');
      setProjects(response.data?.projects || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data?.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const toggleFeature = async (featureKey, currentState) => {
    try {
      const scopeId = 
        selectedScope === 'project' ? selectedProject :
        selectedScope === 'user' ? selectedUser :
        'default';

      await api.post('/admin/features/toggle', {
        feature_key: featureKey,
        enabled: !currentState,
        scope: selectedScope,
        scope_id: scopeId,
        reason: `Toggled via admin UI for ${selectedScope}`
      });

      // Reload features
      loadFeatures();
    } catch (error) {
      console.error('Error toggling feature:', error);
    }
  };

  const toggleCategory = async (category, enabled) => {
    try {
      const scopeId = 
        selectedScope === 'project' ? selectedProject :
        selectedScope === 'user' ? selectedUser :
        'default';

      await api.post('/admin/features/toggle-category', {
        category: category,
        enabled: !enabled,
        scope: selectedScope,
        scope_id: scopeId
      });

      // Reload features
      loadFeatures();
    } catch (error) {
      console.error('Error toggling category:', error);
    }
  };

  const toggleCategoryExpand = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Calculate category status (all on, all off, or mixed)
  const getCategoryStatus = (categoryFeatures) => {
    const enabledCount = categoryFeatures.filter(f => 
      selectedScope === 'project' ? f.enabled_for_project :
      selectedScope === 'user' ? f.enabled_for_user :
      f.enabled_by_default
    ).length;
    
    if (enabledCount === categoryFeatures.length) return 'all-on';
    if (enabledCount === 0) return 'all-off';
    return 'mixed';
  };

  const getCategoryAllEnabled = (categoryFeatures) => {
    return categoryFeatures.every(f => 
      selectedScope === 'project' ? f.enabled_for_project :
      selectedScope === 'user' ? f.enabled_for_user :
      f.enabled_by_default
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin">⌛ กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Toggle2 className="text-blue-600" />
          จัดการสวิตช์ฟีเจอร์
        </h2>

        {/* Scope Selection */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Scope Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ขอบเขต
            </label>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="global">🌐 ทั้งระบบ</option>
              <option value="project">📦 Project</option>
              <option value="user">👤 User</option>
            </select>
          </div>

          {/* Project Selection */}
          {selectedScope === 'project' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เลือก Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">เลือก Project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User Selection */}
          {selectedScope === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เลือก User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">เลือก User...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Feature Categories */}
      <div className="space-y-4">
        {features.map((category) => {
          const isExpanded = expandedCategories[category.category];
          const categoryStatus = getCategoryStatus(category.features);
          const allEnabled = getCategoryAllEnabled(category.features);

          return (
            <div key={category.category} className="border border-gray-200 rounded-lg">
              {/* Category Header */}
              <div
                className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                onClick={() => toggleCategoryExpand(category.category)}
              >
                <div className="flex items-center gap-3 flex-1">
                  {isExpanded ? (
                    <ChevronUp className="text-gray-600" size={20} />
                  ) : (
                    <ChevronDown className="text-gray-600" size={20} />
                  )}
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 capitalize">
                      📋 {getCategoryDisplayName(category.category)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {category.features.length} ฟีเจอร์
                      {categoryStatus === 'all-on' && ' • ทั้งหมดเปิดใช้งาน'}
                      {categoryStatus === 'all-off' && ' • ทั้งหมดปิดใช้งาน'}
                      {categoryStatus === 'mixed' && ' • บางส่วนเปิดใช้งาน'}
                    </p>
                  </div>
                </div>

                {/* Category Toggle */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategory(category.category, allEnabled);
                  }}
                  className={`px-4 py-2 rounded-md font-medium transition cursor-pointer ${
                    categoryStatus === 'all-on'
                      ? 'bg-green-100 text-green-700'
                      : categoryStatus === 'all-off'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {categoryStatus === 'all-on' ? '✓ เปิด' : categoryStatus === 'all-off' ? '✕ ปิด' : '~ ผสม'}
                </div>
              </div>

              {/* Features List */}
              {isExpanded && (
                <div className="divide-y">
                  {category.features.map((feature) => {
                    const isEnabled = 
                      selectedScope === 'project' ? feature.enabled_for_project :
                      selectedScope === 'user' ? feature.enabled_for_user :
                      feature.enabled_by_default;

                    return (
                      <div
                        key={feature.feature_key}
                        className="p-4 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800">
                            {feature.feature_name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {feature.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Key: {feature.feature_key}
                          </p>
                        </div>

                        {/* Feature Toggle Switch */}
                        <button
                          onClick={() => toggleFeature(feature.feature_key, isEnabled)}
                          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                            isEnabled
                              ? 'bg-green-500'
                              : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                              isEnabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Lock size={18} />
          ข้อมูลสำคัญ
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ เปลี่ยนแปลงจะเกิดผลทันที</li>
          <li>✓ คุณสามารถเปิด/ปิดฟีเจอร์ต่อท Project หรือต่อ User</li>
          <li>✓ การตั้งค่า "ทั้งระบบ" จะมีผลต่อทุก Project และ User (ถ้าไม่มีการกำหนดเฉพาะ)</li>
          <li>✓ สามารถติดตามการเปลี่ยนแปลงได้ในล็อก</li>
        </ul>
      </div>
    </div>
  );
}

// Helper function to get display name for categories
function getCategoryDisplayName(category) {
  const names = {
    monitoring: 'ตรวจสอบ',
    reporting: 'สร้างรายงาน',
    trending: 'วิเคราะห์แนวโน้ม',
    control: 'ควบคุม',
    alarming: 'แจ้งเตือน',
    photoview: 'PhotoView SCADA',
    admin: 'Admin Dashboard',
    backup: 'สำรองข้อมูล',
    security: 'ความปลอดภัย'
  };
  return names[category] || category;
}
