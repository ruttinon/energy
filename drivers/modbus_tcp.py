class ModbusTCPDriver:
    def __init__(self, cfg): self.cfg = cfg
    def init(self): return True
    def read_point(self, addr, dt): return 42.0
    def close(self): pass
