import time
import random
import urllib.request
import json

# Replace with the IP address of the host machine running the Heavy Industrial Platform backend
# e.g., SERVER_URL = "http://192.168.1.100:8000/api/telemetry/ingest"
SERVER_URL = "http://127.0.0.1:8000/api/telemetry/ingest"

# Target heavy equipment unit to feed live telemetry for
TARGET_MACHINE_ID = "CAT-HEX-320"

def send_telemetry_packet(temperature, power_status, operating_hours, oil_pressure, hydraulic_pressure, error_codes=None):
    payload = {
        "machine_id": TARGET_MACHINE_ID,
        "temperature": round(temperature, 1),
        "power_status": power_status,
        "operating_hours": round(operating_hours, 1),
        "battery_voltage": round(random.uniform(23.5, 24.5), 1),
        "oil_pressure": round(oil_pressure, 1),
        "hydraulic_pressure": round(hydraulic_pressure, 1),
        "error_codes": error_codes or []
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(SERVER_URL, data=data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            print(f"[LIVE FEED OK] Machine: {payload['machine_id']} | Temp: {payload['temperature']}°C | Health Score: {res_json.get('health_score')}% | RUL: {res_json.get('rul_hours')} hrs")
    except Exception as e:
        print(f"[INGEST ERROR] Could not reach server at {SERVER_URL}: {e}")

def main():
    print("===============================================================")
    print(f"Starting Live Machine Telemetry Feeder for {TARGET_MACHINE_ID}")
    print(f"Target Server Endpoint: {SERVER_URL}")
    print("Press Ctrl+C to stop feeding.")
    print("===============================================================")
    
    operating_hours = 1250.0
    
    try:
        while True:
            # Simulate real-time continuous sensor readings
            temp = random.uniform(70.0, 92.0)
            power = random.choice(["Stable", "Stable", "Stable", "Fluctuating"])
            oil_press = random.uniform(35.0, 42.0)
            hyd_press = random.uniform(3100.0, 3350.0)
            
            # 10% chance of triggering a diagnostic error code
            dtc_codes = []
            if random.random() < 0.10:
                dtc_codes = ["DTC-ERR-802"]

            send_telemetry_packet(temp, power, operating_hours, oil_press, hyd_press, dtc_codes)
            
            operating_hours += 0.1
            time.sleep(3)  # Send sensor telemetry every 3 seconds
    except KeyboardInterrupt:
        print("\nLive Telemetry Stream Stopped.")

if __name__ == "__main__":
    main()
