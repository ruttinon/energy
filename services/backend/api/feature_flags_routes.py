"""
Feature Flags API Endpoints
API สำหรับจัดการสวิตช์เปิด/ปิดฟีเจอร์
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Optional
from services.backend.api.feature_flags import get_feature_manager, FeatureScope
import logging

logger = logging.getLogger("FEATURE_FLAGS_API")

router = APIRouter(prefix="/api/admin/features", tags=["Feature Flags"])

# Get feature manager instance
feature_manager = get_feature_manager()

# Dependency: Check if user is admin
async def get_current_user(token: str = None):
    """Placeholder for authentication"""
    # This should be replaced with actual authentication
    return {"user_id": "admin", "is_admin": True}

async def require_admin(current_user: dict = Depends(get_current_user)):
    """Require admin role"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# =====================================================
# Global Feature Management Endpoints
# =====================================================

@router.get("")
async def get_all_features(current_user: dict = Depends(require_admin)):
    """
    ดึงฟีเจอร์ทั้งหมดแบบ Hierarchical
    GET /api/admin/features
    """
    return feature_manager.get_feature_tree()

@router.get("/list")
async def list_all_features(current_user: dict = Depends(require_admin)):
    """
    ดึงรายชื่อฟีเจอร์ทั้งหมด
    GET /api/admin/features/list
    """
    features = feature_manager.get_all_features()
    return {
        "status": "success",
        "total": len(features),
        "features": features
    }

@router.get("/category/{category}")
async def get_features_by_category(
    category: str,
    current_user: dict = Depends(require_admin)
):
    """
    ดึงฟีเจอร์ตามหมวดหมู่
    GET /api/admin/features/category/monitoring
    """
    features = feature_manager.get_features_by_category(category)
    return {
        "status": "success",
        "category": category,
        "features": features
    }

@router.get("/{feature_key}")
async def get_feature_status(
    feature_key: str,
    current_user: dict = Depends(require_admin)
):
    """
    ดึงสถานะฟีเจอร์พร้อมข้อมูลทั้งหมด
    GET /api/admin/features/monitoring_devices
    """
    return feature_manager.get_feature_status(feature_key)

@router.post("/toggle")
async def toggle_feature(
    request: Dict,
    current_user: dict = Depends(require_admin)
):
    """
    เปิด/ปิดฟีเจอร์
    POST /api/admin/features/toggle
    
    Request body:
    {
        "feature_key": "monitoring_devices",
        "enabled": true,
        "scope": "global",  # global, project, user, group
        "scope_id": "default",  # project_id, user_id, group_id
        "reason": "Maintenance window"
    }
    """
    try:
        feature_key = request.get("feature_key")
        enabled = request.get("enabled", False)
        scope = request.get("scope", "global")
        scope_id = request.get("scope_id", "default")
        reason = request.get("reason", "")
        
        if not feature_key:
            raise HTTPException(status_code=400, detail="feature_key required")
        
        result = feature_manager.set_feature_enabled(
            feature_key=feature_key,
            enabled=enabled,
            scope=FeatureScope(scope),
            scope_id=scope_id,
            set_by_user=current_user.get("user_id", "system"),
            reason=reason
        )
        
        if result:
            return {
                "status": "success",
                "feature_key": feature_key,
                "enabled": enabled,
                "scope": scope,
                "scope_id": scope_id
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to toggle feature")
    except Exception as e:
        logger.error(f"Error toggling feature: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/toggle-category")
async def toggle_category(
    request: Dict,
    current_user: dict = Depends(require_admin)
):
    """
    เปิด/ปิดทั้งหมดในหมวดหมู่
    POST /api/admin/features/toggle-category
    
    Request body:
    {
        "category": "monitoring",
        "enabled": true,
        "scope": "global",
        "scope_id": "default"
    }
    """
    try:
        category = request.get("category")
        enabled = request.get("enabled", False)
        scope = request.get("scope", "global")
        scope_id = request.get("scope_id", "default")
        
        if not category:
            raise HTTPException(status_code=400, detail="category required")
        
        result = feature_manager.toggle_category(category, enabled, scope, scope_id)
        
        return {
            "status": "success",
            "category": category,
            "enabled": enabled,
            **result
        }
    except Exception as e:
        logger.error(f"Error toggling category: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# Project-specific Feature Endpoints
# =====================================================

@router.get("/project/{project_id}")
async def get_project_features(
    project_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    ดึงฟีเจอร์สำหรับ Project เฉพาะ
    GET /api/admin/features/project/proj_123
    """
    return feature_manager.get_project_features(project_id)

@router.post("/project/{project_id}/toggle")
async def toggle_project_feature(
    project_id: str,
    request: Dict,
    current_user: dict = Depends(require_admin)
):
    """
    เปิด/ปิดฟีเจอร์สำหรับ Project
    POST /api/admin/features/project/proj_123/toggle
    """
    try:
        feature_key = request.get("feature_key")
        enabled = request.get("enabled", False)
        reason = request.get("reason", "")
        
        if not feature_key:
            raise HTTPException(status_code=400, detail="feature_key required")
        
        result = feature_manager.set_feature_enabled(
            feature_key=feature_key,
            enabled=enabled,
            scope=FeatureScope.PROJECT,
            scope_id=project_id,
            set_by_user=current_user.get("user_id", "system"),
            reason=reason or f"Project {project_id} feature toggle"
        )
        
        return {
            "status": "success",
            "project_id": project_id,
            "feature_key": feature_key,
            "enabled": enabled
        }
    except Exception as e:
        logger.error(f"Error toggling project feature: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/project/{project_id}/toggle-category")
async def toggle_project_category(
    project_id: str,
    request: Dict,
    current_user: dict = Depends(require_admin)
):
    """
    เปิด/ปิดหมวดหมู่ฟีเจอร์สำหรับ Project
    POST /api/admin/features/project/proj_123/toggle-category
    """
    try:
        category = request.get("category")
        enabled = request.get("enabled", False)
        
        if not category:
            raise HTTPException(status_code=400, detail="category required")
        
        result = feature_manager.toggle_category(category, enabled, "project", project_id)
        
        return {
            "status": "success",
            "project_id": project_id,
            "category": category,
            "enabled": enabled,
            **result
        }
    except Exception as e:
        logger.error(f"Error toggling project category: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# User-specific Feature Endpoints
# =====================================================

@router.get("/user/{user_id}")
async def get_user_features(
    user_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    ดึงฟีเจอร์สำหรับ User เฉพาะ
    GET /api/admin/features/user/user_456
    """
    return feature_manager.get_user_features(user_id)

@router.post("/user/{user_id}/toggle")
async def toggle_user_feature(
    user_id: str,
    request: Dict,
    current_user: dict = Depends(require_admin)
):
    """
    เปิด/ปิดฟีเจอร์สำหรับ User
    POST /api/admin/features/user/user_456/toggle
    """
    try:
        feature_key = request.get("feature_key")
        enabled = request.get("enabled", False)
        reason = request.get("reason", "")
        
        if not feature_key:
            raise HTTPException(status_code=400, detail="feature_key required")
        
        result = feature_manager.set_feature_enabled(
            feature_key=feature_key,
            enabled=enabled,
            scope=FeatureScope.USER,
            scope_id=user_id,
            set_by_user=current_user.get("user_id", "system"),
            reason=reason or f"User {user_id} feature toggle"
        )
        
        return {
            "status": "success",
            "user_id": user_id,
            "feature_key": feature_key,
            "enabled": enabled
        }
    except Exception as e:
        logger.error(f"Error toggling user feature: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/user/{user_id}/toggle-category")
async def toggle_user_category(
    user_id: str,
    request: Dict,
    current_user: dict = Depends(require_admin)
):
    """
    เปิด/ปิดหมวดหมู่ฟีเจอร์สำหรับ User
    POST /api/admin/features/user/user_456/toggle-category
    """
    try:
        category = request.get("category")
        enabled = request.get("enabled", False)
        
        if not category:
            raise HTTPException(status_code=400, detail="category required")
        
        result = feature_manager.toggle_category(category, enabled, "user", user_id)
        
        return {
            "status": "success",
            "user_id": user_id,
            "category": category,
            "enabled": enabled,
            **result
        }
    except Exception as e:
        logger.error(f"Error toggling user category: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# Feature Check Endpoints (for frontend/client)
# =====================================================

@router.get("/check/{feature_key}")
async def check_feature(
    feature_key: str,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
):
    """
    ตรวจสอบว่าฟีเจอร์เปิดใช้งานหรือไม่
    GET /api/admin/features/check/monitoring_devices?user_id=user_456&project_id=proj_123
    
    Returns:
    {
        "feature_key": "monitoring_devices",
        "enabled": true,
        "user_id": "user_456",
        "project_id": "proj_123"
    }
    """
    enabled = feature_manager.is_feature_enabled(
        feature_key=feature_key,
        user_id=user_id,
        project_id=project_id
    )
    
    return {
        "feature_key": feature_key,
        "enabled": enabled,
        "user_id": user_id,
        "project_id": project_id
    }

@router.post("/check-multiple")
async def check_multiple_features(
    request: Dict
):
    """
    ตรวจสอบหลายฟีเจอร์พร้อมกัน
    POST /api/admin/features/check-multiple
    
    Request body:
    {
        "features": ["monitoring_devices", "reporting_pdf", "control_manual"],
        "user_id": "user_456",
        "project_id": "proj_123"
    }
    
    Returns:
    {
        "monitoring_devices": true,
        "reporting_pdf": false,
        "control_manual": true
    }
    """
    features = request.get("features", [])
    user_id = request.get("user_id")
    project_id = request.get("project_id")
    
    result = {}
    for feature_key in features:
        result[feature_key] = feature_manager.is_feature_enabled(
            feature_key=feature_key,
            user_id=user_id,
            project_id=project_id
        )
    
    return result

# =====================================================
# Management Endpoints
# =====================================================

@router.post("/initialize")
async def initialize_features(current_user: dict = Depends(require_admin)):
    """
    สร้างฟีเจอร์เริ่มต้นทั้งหมด
    POST /api/admin/features/initialize
    """
    try:
        feature_manager.initialize_default_features()
        return {
            "status": "success",
            "message": "Default features initialized"
        }
    except Exception as e:
        logger.error(f"Error initializing features: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add")
async def add_feature(
    request: Dict,
    current_user: dict = Depends(require_admin)
):
    """
    เพิ่มฟีเจอร์ใหม่
    POST /api/admin/features/add
    
    Request body:
    {
        "feature_key": "new_feature",
        "feature_name": "New Feature",
        "description": "Description",
        "category": "general"
    }
    """
    try:
        feature_key = request.get("feature_key")
        feature_name = request.get("feature_name")
        description = request.get("description", "")
        category = request.get("category", "general")
        
        if not feature_key or not feature_name:
            raise HTTPException(status_code=400, detail="feature_key and feature_name required")
        
        result = feature_manager.add_feature(feature_key, feature_name, description, category)
        
        return {
            "status": "success" if result else "error",
            "feature_key": feature_key
        }
    except Exception as e:
        logger.error(f"Error adding feature: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dependency")
async def add_dependency(
    request: Dict,
    current_user: dict = Depends(require_admin)
):
    """
    เพิ่มความสัมพันธ์ระหว่างฟีเจอร์ (parent-child)
    POST /api/admin/features/dependency
    
    Request body:
    {
        "parent_feature": "reporting",
        "child_feature": "reporting_pdf"
    }
    """
    try:
        parent = request.get("parent_feature")
        child = request.get("child_feature")
        
        if not parent or not child:
            raise HTTPException(status_code=400, detail="parent_feature and child_feature required")
        
        result = feature_manager.add_feature_dependency(parent, child)
        
        return {
            "status": "success" if result else "error",
            "parent_feature": parent,
            "child_feature": child
        }
    except Exception as e:
        logger.error(f"Error adding dependency: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Export router for FastAPI app
__all__ = ["router"]
