
import requests
import xml.etree.ElementTree as ET
import json

IP = "192.168.1.106"
TIMEOUT = 5

def scan_xml():
    url = f"http://{IP}/services/user/values.xml"
    print(f"📡 Probing XML API: {url}")
    try:
        r = requests.get(url, timeout=TIMEOUT)
        if r.status_code == 200:
            print("✅ XML API Found!")
            # Save raw for inspection
            with open("powerstudio_dump.xml", "w", encoding="utf-8") as f:
                f.write(r.text)
            
            try:
                root = ET.fromstring(r.text)
                vars_found = []
                for child in root:
                    # Usually <variable id="ID" ...> or <device ...>
                    if 'id' in child.attrib:
                        vars_found.append(child.attrib['id'])
                
                print(f"📋 Found {len(vars_found)} variables (first 10): {vars_found[:10]}")
            except Exception as e:
                print(f"⚠️ XML Parse Error: {e}")
        else:
            print(f"❌ XML API returned {r.status_code}")
    except Exception as e:
        print(f"❌ XML Probe Failed: {e}")

def scan_json():
    # Helper for HTML5 client API
    url = f"http://{IP}/html5/values.json?var=STATUS" # Guessing entry point
    print(f"\n📡 Probing JSON API: {url}")
    try:
        r = requests.get(url, timeout=TIMEOUT)
        if r.status_code == 200:
            print("✅ JSON API Found!")
            print("📄 Response Preview:", r.text[:200])
        else:
            print(f"❌ JSON API returned {r.status_code}")
            
        # Try probing devices list if possible
        url2 = f"http://{IP}/services/user/devices.xml" 
        print(f"📡 Probing Devices List: {url2}")
        r2 = requests.get(url2, timeout=TIMEOUT)
        if r2.status_code == 200:
            print("✅ Devices XML Found!")
            with open("powerstudio_devices.xml", "w", encoding="utf-8") as f:
                f.write(r2.text)
    except Exception as e:
        print(f"❌ JSON Probe Failed: {e}")


def deep_scan(devices):
    print(f"\n🕵️ Deep Scanning {len(devices)} devices...")
    common_suffixes = ['VI', 'II', 'KW', 'PF', 'Freq', 'AE', 'V1', 'V2', 'V3', 'I1', 'I2', 'I3', 'P', 'Q', 'S']
    
    for dev in devices:
        print(f"  👉 Probing Device: {dev}")
        
        # 1. Try to get Device Info (if endpoint exists)
        try:
            url = f"http://{IP}/services/user/deviceInfo.xml?id={dev}"
            r = requests.get(url, timeout=2)
            if r.status_code == 200 and "<error>" not in r.text:
                 print(f"    ✅ Info Found for {dev}")
                 with open(f"powerstudio_{dev}_info.xml", "w", encoding="utf-8") as f: f.write(r.text)
        except: pass

        # 2. Brute-force common standard variables
        # Construct a batch request: ?var=DEV.VI&var=DEV.II ...
        params = []
        for suf in common_suffixes:
            params.append(f"var={dev}.{suf}")
        
        query = "&".join(params)
        url = f"http://{IP}/services/user/values.xml?{query}"
        
        try:
            r = requests.get(url, timeout=3)
            if r.status_code == 200:
                root = ET.fromstring(r.text)
                found = 0
                for child in root:
                    # <variable id="CVNC4.VI">...</variable>
                    if 'id' in child.attrib:
                         print(f"      ✅ Found Variable: {child.attrib['id']} = {child.text}")
                         found += 1
                if found == 0:
                    print(f"    ❌ No standard variables found for {dev}")
        except Exception as e:
            print(f"    ⚠️ Probe failed: {e}")

if __name__ == "__main__":
    print("🚀 Starting PowerStudio Scanner...")
    scan_xml()
    # Devices found from previous step (อ่านจากไฟล์หรือ database จริงเท่านั้น)
    deep_scan(known_devices)
    scan_json()
