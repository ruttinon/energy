/**
 * User Permission System for Mobile
 * Defines what each user role can access
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  GUEST: 'guest'
};

// Define what each role can access
export const ROLE_PERMISSIONS = {
  admin: {
    dashboard: true,
    monitor: true,
    trends: true,
    alarms: true,
    consumption: true,
    billing: true,
    photoview: true,
    powerstudio: true,
    support: true,
    profile: true,
    payment: true,
    service: true,
    // Admin only
    device_manager: true,
    alert_config: true,
    system_core: true,
    user_management: true,
    billing_settings: true,
    extension_control: true,
    admin_overview: true
  },
  manager: {
    dashboard: true,
    monitor: true,
    trends: true,
    alarms: true,
    consumption: true,
    billing: true,
    photoview: true,
    powerstudio: true,
    support: true,
    profile: true,
    // Restricted
    device_manager: false,      // Can't configure devices
    alert_config: false,         // Can't change alert rules
    system_core: false,          // Can't manage system
    user_management: false,      // Can't manage users
    billing_settings: false,     // Can't change billing
    extension_control: false,    // Can't control extensions
    payment: false,              // Can't process payments
    service: false               // Can't manage service tickets
  },
  operator: {
    dashboard: true,
    monitor: true,
    trends: true,
    alarms: true,
    consumption: true,
    photoview: true,
    support: true,
    profile: true,
    // Restricted
    billing: false,              // Can't see billing
    powerstudio: false,          // Can't use PowerStudio
    device_manager: false,
    alert_config: false,
    system_core: false,
    user_management: false,
    billing_settings: false,
    extension_control: false,
    payment: false,
    service: false
  },
  guest: {
    dashboard: true,
    monitor: true,
    trends: true,
    alarms: true,
    photoview: true,
    support: true,
    profile: true,
    // Most things restricted
    consumption: false,
    billing: false,
    powerstudio: false,
    device_manager: false,
    alert_config: false,
    system_core: false,
    user_management: false,
    billing_settings: false,
    extension_control: false,
    payment: false,
    service: false
  }
};

/**
 * Check if user can access a feature
 */
export function canAccessFeature(userRole, feature) {
  const permissions = ROLE_PERMISSIONS[userRole] || {};
  return permissions[feature] === true;
}

/**
 * Get allowed modules for a user
 */
export function getAccessibleModules(userRole) {
  const permissions = ROLE_PERMISSIONS[userRole] || {};
  return Object.keys(permissions).filter(key => permissions[key] === true);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role) {
  const names = {
    admin: 'ผู้ดูแลระบบ',
    manager: 'ผู้จัดการ',
    operator: 'ผู้ดำเนินการ',
    guest: 'แขก'
  };
  return names[role] || role;
}
