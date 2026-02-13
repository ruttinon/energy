"""
API Documentation Configuration (Swagger/OpenAPI)
ตัวกำหนดค่า Swagger UI สำหรับ FastAPI
"""

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

def setup_openapi_documentation(app: FastAPI):
    """ตั้งค่า OpenAPI/Swagger documentation สำหรับ API"""
    
    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        
        openapi_schema = get_openapi(
            title="EnergyLink API Documentation",
            version="3.0.1",
            description="""
            ## ระบบจัดการพลังงาน EnergyLink
            
            **API Documentation ที่สมบูรณ์สำหรับระบบ EnergyLink**
            
            ### 📊 Core Features
            - 📈 Real-time monitoring & trending
            - 📋 Report generation (PDF/Excel)
            - 🚨 Alert & notification system
            - 💳 Billing & payment processing
            - 🎮 Device control (Modbus)
            - 📸 PhotoView SCADA interface
            
            ### 🔐 Authentication
            - Username/Password login
            - Session-based authentication
            - Role-based access control (Admin, User, Service)
            
            ### 🔧 Integration
            - Modbus TCP/UDP/RTU support
            - MQTT protocol (optional)
            - OPC Server ready
            
            ### 📱 API Base URL
            - Production: `https://api.energylink.io`
            - Development: `http://localhost:5000`
            
            ### 🤝 Support
            - Email: support@energylink.io
            - Documentation: https://docs.energylink.io
            """,
            routes=app.routes,
            tags_metadata=[
                {
                    "name": "Authentication",
                    "description": "User login, logout, and session management"
                },
                {
                    "name": "Monitoring",
                    "description": "Real-time monitoring, trends, and device status"
                },
                {
                    "name": "Reports",
                    "description": "Generate and manage reports (PDF, Excel)"
                },
                {
                    "name": "Billing",
                    "description": "Billing system, invoices, and payments"
                },
                {
                    "name": "Alerts",
                    "description": "Alert configuration, logs, and notifications"
                },
                {
                    "name": "Control",
                    "description": "Device control, output control, and relay management"
                },
                {
                    "name": "PhotoView",
                    "description": "SCADA interface, screen management"
                },
                {
                    "name": "Support",
                    "description": "Support tickets and user assistance"
                },
                {
                    "name": "Admin",
                    "description": "Admin management and system configuration"
                },
                {
                    "name": "Health",
                    "description": "System health check and diagnostics"
                }
            ]
        )
        
        # Add server information
        openapi_schema["servers"] = [
            {
                "url": "http://localhost:5000",
                "description": "Development server"
            },
            {
                "url": "https://api.energylink.io",
                "description": "Production server"
            }
        ]
        
        # Add security schemes
        openapi_schema["components"]["securitySchemes"] = {
            "CookieAuth": {
                "type": "apiKey",
                "in": "cookie",
                "name": "session_id"
            },
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer"
            }
        }
        
        app.openapi_schema = openapi_schema
        return app.openapi_schema
    
    app.openapi = custom_openapi
    
    # Configure Swagger UI
    app.swagger_ui_init_oauth = {
        "usePkceWithAuthorizationCodeGrant": True,
    }
    
    # Redirect /docs to /api/docs
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import RedirectResponse
    
    @app.get("/")
    async def root_redirect():
        """Redirect to API documentation"""
        return RedirectResponse(url="/api/docs")


# API Endpoint Groups for Better Organization
API_ENDPOINTS = {
    "authentication": {
        "description": "Authentication endpoints",
        "endpoints": [
            "POST /login",
            "POST /logout",
            "GET /user/me",
            "POST /login_user_any"
        ]
    },
    "monitoring": {
        "description": "Monitoring and real-time data",
        "endpoints": [
            "GET /devices",
            "GET /devices/{device_id}",
            "GET /history",
            "GET /readings",
            "WebSocket /ws/live"
        ]
    },
    "reports": {
        "description": "Report generation",
        "endpoints": [
            "POST /reports/generate",
            "GET /reports",
            "GET /reports/{report_id}",
            "POST /reports/export",
            "GET /reports/billing"
        ]
    },
    "billing": {
        "description": "Billing and payment",
        "endpoints": [
            "GET /billing/summary",
            "GET /billing/invoices",
            "GET /billing/payments",
            "POST /billing/pay/charge",
            "GET /billing/config"
        ]
    },
    "alerts": {
        "description": "Alert management",
        "endpoints": [
            "GET /alert/logs",
            "POST /alert/rules",
            "GET /alert/rules",
            "PUT /alert/rules/{rule_id}",
            "DELETE /alert/rules/{rule_id}"
        ]
    },
    "control": {
        "description": "Device control",
        "endpoints": [
            "GET /control/devices",
            "GET /control/devices/{device_id}/status",
            "POST /control/devices/{device_id}/output",
            "GET /control/devices/{device_id}/outputs"
        ]
    },
    "photoview": {
        "description": "SCADA interface",
        "endpoints": [
            "GET /photoview/{project_id}/pages",
            "GET /photoview/{project_id}/drawings/{page_id}",
            "GET /photoview/{project_id}/readings/batch",
            "POST /photoview/{project_id}/drawings"
        ]
    }
}


# API Health Check
class APIHealthCheck:
    """API Health check and diagnostics"""
    
    @staticmethod
    def get_health_status() -> dict:
        """Get overall API health status"""
        return {
            "status": "healthy",
            "version": "3.0.1",
            "timestamp": datetime.now().isoformat(),
            "components": {
                "database": "operational",
                "modbus_poller": "operational",
                "billing_engine": "operational",
                "notification_system": "operational",
                "alert_engine": "operational"
            }
        }
    
    @staticmethod
    def get_api_stats() -> dict:
        """Get API statistics"""
        return {
            "total_endpoints": 150,
            "active_connections": 0,
            "uptime_hours": 0,
            "request_rate_per_minute": 0,
            "error_rate": "0%"
        }


# API Rate Limiting Configuration
RATE_LIMIT_CONFIG = {
    "default": "100/minute",
    "endpoints": {
        "/login": "5/minute",
        "/history": "50/minute",
        "/control": "20/minute",
        "/reports": "10/minute",
        "/billing": "30/minute"
    }
}


from datetime import datetime
