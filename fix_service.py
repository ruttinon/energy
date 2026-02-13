import os
import struct
import socket
import time

path = r'c:\Users\promb\Desktop\energylink\services\backend\api\control\service.py'

if not os.path.exists(path):
    print(f"File not found: {path}")
    exit(1)

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find start of _write_modbus
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'def _write_modbus(' in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find _write_modbus")
    exit(1)

# Find end (start of execute_control)
for i in range(start_idx + 1, len(lines)):
    if 'def execute_control(' in line.strip(): # Check if line contains signature
        pass
    if line.strip().startswith('def execute_control('):
        end_idx = i
        break

if end_idx == -1:
    print("Could not find start of execute_control")
    # Fallback: look for any def at same indentation level (level 1)
    for i in range(start_idx + 1, len(lines)):
         if line.startswith('    def '):
             end_idx = i
             break

if end_idx == -1:
    print("Could not find end of function")
    exit(1)

print(f"Replacing lines {start_idx} to {end_idx}")

# New content
new_method = r'''    def _write_modbus(self, ip: str, port: int, slave: int, address: int, value: int, function: int = 5, protocol: str = "modbus_tcp") -> bool:
        """
        Execute Modbus Write Command with Retry (3 Attempts)
        """
        for attempt in range(1, 4):
            try:
                print(f"[CONTROL] Write Attempt {attempt}/3: {ip}:{port} S{slave} A{address} V{hex(value)} F{function}")
                
                # 1. RTU over TCP
                if protocol == "tcp":
                    try:
                        payload = struct.pack(">B B H H", slave, function, address, value)
                        crc = 0xFFFF
                        for ch in payload:
                            crc ^= ch
                            for _ in range(8):
                                if crc & 1: crc = (crc >> 1) ^ 0xA001
                                else: crc >>= 1
                        frame = payload + struct.pack("<H", crc)
                        
                        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        s.settimeout(3.0)
                        s.connect((ip, port))
                        s.send(frame)
                        resp = s.recv(1024)
                        s.close()
                        
                        if len(resp) >= 5:
                            r_slave, r_func = struct.unpack(">B B", resp[:2])
                            if r_slave == slave and r_func == function:
                                return True
                    except Exception as e:
                        print(f"[CONTROL] RTU Write Error: {e}")

                # 2. Modbus TCP (Pymodbus)
                if ModbusTcpClient and protocol == "modbus_tcp":
                    try:
                        client = ModbusTcpClient(ip, port=port, timeout=3.0)
                        if client.connect():
                            rr = None
                            if function == 5:
                                rr = client.write_coil(address, value == 0xFF00, slave=slave)
                            elif function == 6:
                                rr = client.write_register(address, value, slave=slave)
                            client.close()
                            if rr and not rr.isError():
                                return True
                    except Exception as e:
                        print(f"[CONTROL] Pymodbus Write Error: {e}")

                # 3. Raw Socket Fallback
                try:
                    tid = int(time.time() * 1000) & 0xFFFF
                    pdu = struct.pack(">B B H H", slave, function, address, value)
                    mbap = struct.pack(">H H H", tid, 0, len(pdu))
                    req = mbap + pdu
                    
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(3.0)
                    s.connect((ip, port))
                    s.send(req)
                    resp = s.recv(1024)
                    s.close()
                    
                    if len(resp) >= 9:
                        r_tid, _, _, _, r_func = struct.unpack(">H H H B B", resp[:8])
                        if r_tid == tid and r_func == function:
                            return True
                except Exception as e:
                    print(f"[CONTROL] Raw Write Error: {e}")

            except Exception as e:
                print(f"[CONTROL] Write Error: {e}")
            
            time.sleep(0.5)
        
        return False
'''

# Preserve lines before and after
new_lines = lines[:start_idx] + [new_method + '\n'] + lines[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully updated _write_modbus")
