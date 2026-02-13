"""
Audit Log API Endpoints
=======================

REST API for accessing and viewing audit trails and activity logs
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from services.backend.api.audit.audit_logger import get_audit_logger, init_audit_logger

router = APIRouter()

def get_current_user_from_session(request) -> str:
    """Extract current user from session (to be integrated with main auth)"""
    # This will be provided by the main FastAPI app
    # For now, returns placeholder - replace with actual session extraction
    return "system"

from pydantic import BaseModel

class AuditLogRequest(BaseModel):
    project_id: str
    username: str
    action: str
    event_type: str
    details: Optional[str] = None
    device_id: Optional[str] = None

@router.post('/api/audit/log')
def create_audit_log(
    log_data: AuditLogRequest,
    current_user: str = Depends(get_current_user_from_session)
):
    """
    Create a new audit log entry from external sources (frontend)
    """
    try:
        logger = get_audit_logger()
        logger.log_event(
            project_id=log_data.project_id,
            username=log_data.username,
            action=log_data.action,
            event_type=log_data.event_type,
            details=log_data.details,
            device_id=log_data.device_id
        )
        return {"status": "ok", "message": "Log entry created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Logging error: {str(e)}")

@router.get('/api/audit/activity')
def get_activity_log(
    project_id: str,
    username: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    days: Optional[int] = Query(30),
    limit: Optional[int] = Query(1000),
    current_user: str = Depends(get_current_user_from_session)
):
    """
    Get audit activity log with optional filters
    
    Query Parameters:
    - username: Filter by specific user
    - event_type: Filter by event type (LOGIN, LOGOUT, DEVICE_CONTROL, CONFIG_CHANGE, etc)
    - days: Days to look back (default: 30)
    - limit: Maximum results to return (default: 1000)
    """
    try:
        logger = get_audit_logger()
        logs = logger.get_activity_log(
            project_id=project_id,
            username=username,
            event_type=event_type,
            days=days,
            limit=limit
        )
        
        return {
            "status": "ok",
            "total": len(logs),
            "project_id": project_id,
            "filters": {
                "username": username,
                "event_type": event_type,
                "days": days
            },
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit log error: {str(e)}")

@router.get('/api/audit/user/{username}')
def get_user_activity(
    project_id: str,
    username: str,
    days: Optional[int] = Query(30),
    current_user: str = Depends(get_current_user_from_session)
):
    """
    Get summary of specific user's activity
    
    Shows:
    - Total actions in period
    - Last activity timestamp
    - Breakdown of actions by type
    """
    try:
        logger = get_audit_logger()
        activity = logger.get_user_activity(
            project_id=project_id,
            username=username,
            days=days
        )
        
        return {
            "status": "ok",
            "project_id": project_id,
            "user_activity": activity
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user activity: {str(e)}")

@router.get('/api/audit/device/{device_id}')
def get_device_activity(
    project_id: str,
    device_id: str,
    days: Optional[int] = Query(30),
    current_user: str = Depends(get_current_user_from_session)
):
    """
    Get all actions performed on a specific device
    
    Shows history of:
    - Control commands (trip, close)
    - Configuration changes
    - User interactions
    """
    try:
        logger = get_audit_logger()
        activities = logger.get_device_activity(
            project_id=project_id,
            device_id=device_id,
            days=days
        )
        
        return {
            "status": "ok",
            "project_id": project_id,
            "device_id": device_id,
            "total_actions": len(activities),
            "activities": activities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching device activity: {str(e)}")

@router.get('/api/audit/summary')
def get_audit_summary(
    project_id: str,
    days: Optional[int] = Query(30),
    current_user: str = Depends(get_current_user_from_session)
):
    """
    Get summary statistics of audit logs
    
    Shows:
    - Total events in period
    - Events by type (pie chart data)
    - Top users by action count
    - Common actions
    """
    try:
        logger = get_audit_logger()
        logs = logger.get_activity_log(
            project_id=project_id,
            days=days,
            limit=10000
        )
        
        # Calculate statistics
        event_types = {}
        users = {}
        actions = {}
        
        for log in logs:
            # Count event types
            event_type = log['event_type']
            event_types[event_type] = event_types.get(event_type, 0) + 1
            
            # Count by user
            if log['username']:
                users[log['username']] = users.get(log['username'], 0) + 1
            
            # Count actions
            action = log['action']
            actions[action] = actions.get(action, 0) + 1
        
        # Get top users
        top_users = sorted(users.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return {
            "status": "ok",
            "project_id": project_id,
            "period_days": days,
            "total_events": len(logs),
            "event_types": event_types,
            "top_users": [{"username": u, "action_count": c} for u, c in top_users],
            "top_actions": sorted(actions.items(), key=lambda x: x[1], reverse=True)[:10]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")

@router.post('/api/audit/cleanup')
def cleanup_old_logs(
    project_id: str,
    days: Optional[int] = Query(90),
    current_user: str = Depends(get_current_user_from_session)
):
    """
    Remove logs older than specified number of days
    
    This is for maintenance - permanently deletes old audit records
    Default: 90 days
    """
    try:
        logger = get_audit_logger()
        deleted_count = logger.cleanup_old_logs(
            project_id=project_id,
            days=days
        )
        
        return {
            "status": "ok",
            "project_id": project_id,
            "deleted_records": deleted_count,
            "message": f"Cleaned up logs older than {days} days"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup error: {str(e)}")

@router.get('/api/audit/export')
def export_audit_logs(
    project_id: str,
    format: Optional[str] = Query("json"),
    days: Optional[int] = Query(30),
    current_user: str = Depends(get_current_user_from_session)
):
    """
    Export audit logs in specified format (json or csv)
    """
    try:
        logger = get_audit_logger()
        logs = logger.get_activity_log(
            project_id=project_id,
            days=days,
            limit=100000
        )
        
        if format.lower() == "csv":
            # Return CSV format
            import csv
            import io
            
            output = io.StringIO()
            if logs:
                writer = csv.DictWriter(output, fieldnames=logs[0].keys())
                writer.writeheader()
                writer.writerows(logs)
            
            return {
                "status": "ok",
                "format": "csv",
                "data": output.getvalue()
            }
        else:
            # Return JSON format
            return {
                "status": "ok",
                "format": "json",
                "total_records": len(logs),
                "data": logs
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")
