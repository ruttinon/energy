import socket
import time

try:
    from pymodbus.client import ModbusTcpClient
except Exception:
    ModbusTcpClient = None

def test_relay_connection(ip: str, port: int = 502) -> dict:
    """
    Test connection to a Modbus TCP Relay Board.
    """
    if not ip:
        return {"status": "error", "message": "IP Address required"}
    
    if ModbusTcpClient is None:
        return {"status": "error", "message": "pymodbus not installed"}
    
    try:
        client = ModbusTcpClient(ip, port=port, timeout=3)
        if client.connect():
            client.close()
            return {"status": "ok", "message": f"Connected to {ip}:{port}"}
        else:
            return {"status": "error", "message": "Connection refused"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def control_relay(ip: str, channel: int, state: bool, port: int = 502, unit_id: int = 1) -> dict:
    """
    Control a specific relay channel.
    channel: 1-based index (will be converted to 0-based address if needed).
    state: True (ON/Close), False (OFF/Open).
    """
    if ModbusTcpClient is None:
        return {"status": "error", "message": "pymodbus not installed"}
    
    client = ModbusTcpClient(ip, port=port, timeout=3)
    try:
        if not client.connect():
            return {"status": "error", "message": "Connection failed"}

        # Address: Many relay boards map Relay 1 to Address 0, or Address 1.
        # Standard assumption: Relay N is at Coil Address N-1
        coil_address = channel - 1 
        if coil_address < 0: coil_address = 0

        # Write Coil (Function 05)
        # write_coil(address, value, slave=unit_id)
        result = client.write_coil(coil_address, state, slave=unit_id)
        
        if result.isError():
             return {"status": "error", "message": f"Modbus Error: {result}"}
        
        return {"status": "ok", "message": f"Relay {channel} set to {'ON' if state else 'OFF'}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        client.close()
