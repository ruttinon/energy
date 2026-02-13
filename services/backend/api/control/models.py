from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class ControlDescriptor(BaseModel):
    device_id: str = Field(..., description="ID of the Meter/Device to control")
    control_mode: Literal["internal", "external"] = Field(..., description="Control mechanism source")
    control_target: str = Field(..., description="Target relay/coil ID (e.g., 'relay_1')")
    action: Literal["ON", "OFF", "TOGGLE", "0", "1"] = Field(..., description="Action to perform")
    reason: Literal["manual", "auto", "alarm", "schedule"] = Field("manual", description="Reason for the action")
    operator: str = Field("admin", description="User performing the action")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now, description="Timestamp of the action")
    project_id: Optional[str] = Field(None, description="Project ID context for the control action")

class AuditLogEntry(ControlDescriptor):
    status: Literal["success", "failed"]
    error_message: Optional[str] = None
    executed_at: datetime = Field(default_factory=datetime.now)

class ControlConfig(BaseModel):
    """Configuration for a controllable device"""
    device_id: str
    control_type: Literal["internal_relay", "external_module"]
    
    # Internal Relay Config
    relay_address: Optional[int] = None # Modbus Address
    
    # External Module Config
    external_module_id: Optional[str] = None
    external_channel: Optional[int] = None
    
    # Safety
    fail_safe_state: Literal["open", "closed", "last"] = "last"
    max_switching_per_hour: int = 10
