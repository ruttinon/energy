
import time
from pymodbus.client import ModbusTcpClient
import struct

# Configuration
HOST = "61.91.56.190"
PORT = 5502
SLAVE = 1
ADDRESS = 19843 # ActiveEnergy_kWh for DIRIS A-40
SCALE = 10.0 # From template

def decode_int32(registers):
    if not registers or len(registers) < 2:
        return None
    # Big Endian (High Word First?) 
    # DIRIS usually Big Endian. 
    # [High, Low]
    raw = struct.pack('>HH', registers[0], registers[1])
    return struct.unpack('>i', raw)[0]

def run():
    print(f"Connecting to {HOST}:{PORT} (Slave {SLAVE})...")
    client = ModbusTcpClient(HOST, port=PORT)
    if not client.connect():
        print("❌ Connection failed")
        return

    print("✅ Connected. Polling Address", ADDRESS)
    
    for i in range(5):
        print(f"\n--- Poll {i+1}/5 ---")
        
        # Try Function 3 (Holding)
        try:
            rr3 = client.read_holding_registers(ADDRESS, 2, slave=SLAVE)
            if rr3.isError():
                print(f"Func 3: ❌ Error: {rr3}")
            else:
                val = decode_int32(rr3.registers)
                scaled = val / SCALE if val is not None else 0
                print(f"Func 3: ✅ Registers: {rr3.registers} -> Raw: {val} -> Scaled: {scaled} kWh")
        except Exception as e:
            print(f"Func 3: 💥 Exception: {e}")

        # Try Function 4 (Input)
        try:
            rr4 = client.read_input_registers(ADDRESS, 2, slave=SLAVE)
            if rr4.isError():
                print(f"Func 4: ❌ Error: {rr4}")
            else:
                val = decode_int32(rr4.registers)
                scaled = val / SCALE if val is not None else 0
                print(f"Func 4: ✅ Registers: {rr4.registers} -> Raw: {val} -> Scaled: {scaled} kWh")
        except Exception as e:
            print(f"Func 4: 💥 Exception: {e}")
            
        time.sleep(2)

    client.close()

if __name__ == "__main__":
    run()
