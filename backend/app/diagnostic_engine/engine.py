from typing import Dict, Any, List

class DiagnosticEngine:
    @staticmethod
    def run_diagnostics(reference: Dict[str, Any], current: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deterministic comparison between reference and current machine configuration.
        Returns a dict:
        {
            "status": "Healthy" | "Warning" | "Fault",
            "health_score": int (0-100),
            "issues": [
                {
                    "parameter": str,
                    "severity": "Info" | "Warning" | "Critical",
                    "expected": str | int | float,
                    "current": str | int | float,
                    "message": str
                }
            ],
            "metrics": {
                "temperature": float,
                "power_status": str
            }
        }
        """
        issues: List[Dict[str, Any]] = []
        health_score = 100

        # 1. Firmware Version check
        ref_fw = reference.get("firmware")
        cur_fw = current.get("firmware")
        if ref_fw != cur_fw:
            severity = "Critical"
            health_score -= 20
            issues.append({
                "parameter": "Firmware Version",
                "severity": severity,
                "expected": ref_fw,
                "current": cur_fw,
                "message": f"Firmware version mismatch. Expected '{ref_fw}', found '{cur_fw}'."
            })

        # 2. PLC Version check
        ref_plc = reference.get("plc_version")
        cur_plc = current.get("plc_version")
        if ref_plc != cur_plc:
            severity = "Warning"
            health_score -= 10
            issues.append({
                "parameter": "PLC Version",
                "severity": severity,
                "expected": ref_plc,
                "current": cur_plc,
                "message": f"PLC configuration version mismatch. Expected '{ref_plc}', found '{cur_plc}'."
            })

        # 3. CPU check
        ref_cpu = reference.get("cpu")
        cur_cpu = current.get("cpu")
        if ref_cpu != cur_cpu:
            severity = "Critical"
            health_score -= 25
            issues.append({
                "parameter": "CPU Architecture",
                "severity": severity,
                "expected": ref_cpu,
                "current": cur_cpu,
                "message": f"Processor type mismatch. Reference specifies '{ref_cpu}' but found '{cur_cpu}'."
            })

        # 4. RAM check
        ref_ram = reference.get("ram")
        cur_ram = current.get("ram")
        if ref_ram != cur_ram:
            severity = "Warning"
            health_score -= 15
            issues.append({
                "parameter": "RAM (Memory)",
                "severity": severity,
                "expected": ref_ram,
                "current": cur_ram,
                "message": f"System memory allocation mismatch. Expected '{ref_ram}', active size is '{cur_ram}'."
            })

        # 5. Storage check
        ref_storage = reference.get("storage")
        cur_storage = current.get("storage")
        if ref_storage != cur_storage:
            severity = "Warning"
            health_score -= 10
            issues.append({
                "parameter": "Storage",
                "severity": severity,
                "expected": ref_storage,
                "current": cur_storage,
                "message": f"Secondary storage size mismatch. Expected '{ref_storage}', detected '{cur_storage}'."
            })

        # 6. Communication Ports check
        ref_ports = set(reference.get("communication_ports", []))
        cur_ports = set(current.get("communication_ports", []))
        missing_ports = ref_ports - cur_ports
        extra_ports = cur_ports - ref_ports
        if missing_ports:
            severity = "Critical"
            health_score -= 15 * len(missing_ports)
            issues.append({
                "parameter": "Communication Ports",
                "severity": severity,
                "expected": list(ref_ports),
                "current": list(cur_ports),
                "message": f"Required port(s) offline: {', '.join(missing_ports)}."
            })
        if extra_ports:
            severity = "Info"
            # Info issues don't penalize health score heavily
            issues.append({
                "parameter": "Communication Ports",
                "severity": severity,
                "expected": list(ref_ports),
                "current": list(cur_ports),
                "message": f"Extra ports active: {', '.join(extra_ports)}."
            })

        # 7. Installed Modules check
        ref_modules = set(reference.get("installed_modules", []))
        cur_modules = set(current.get("installed_modules", []))
        missing_modules = ref_modules - cur_modules
        if missing_modules:
            severity = "Critical"
            health_score -= 20 * len(missing_modules)
            issues.append({
                "parameter": "Installed Modules",
                "severity": severity,
                "expected": list(ref_modules),
                "current": list(cur_modules),
                "message": f"Critical expansion module(s) missing or failed: {', '.join(missing_modules)}."
            })

        # 8. Sensor Count check
        ref_sensors = reference.get("sensor_count", 0)
        cur_sensors = current.get("sensor_count", 0)
        if ref_sensors != cur_sensors:
            severity = "Warning"
            health_score -= 10
            issues.append({
                "parameter": "Sensor Count",
                "severity": severity,
                "expected": ref_sensors,
                "current": cur_sensors,
                "message": f"Active sensor count mismatch. Expected '{ref_sensors}' nodes, detected '{cur_sensors}' nodes."
            })

        # 9. Temperature telemetry check
        cur_temp = current.get("temperature", 45.0)
        if cur_temp >= 90.0:
            severity = "Critical"
            health_score -= 35
            issues.append({
                "parameter": "Operating Temperature",
                "severity": severity,
                "expected": "Under 70 C",
                "current": f"{cur_temp} C",
                "message": f"CRITICAL: Operating temperature is dangerously high at {cur_temp} C. Immediate cooldown or shutdown required."
            })
        elif cur_temp >= 75.0:
            severity = "Warning"
            health_score -= 15
            issues.append({
                "parameter": "Operating Temperature",
                "severity": severity,
                "expected": "Under 70 C",
                "current": f"{cur_temp} C",
                "message": f"WARNING: Temperature elevated at {cur_temp} C. Monitor coolant levels."
            })

        # 10. Power Status check
        cur_power = current.get("power_status", "Stable")
        if cur_power == "Low Voltage":
            severity = "Critical"
            health_score -= 30
            issues.append({
                "parameter": "Power Supply Status",
                "severity": severity,
                "expected": "Stable",
                "current": cur_power,
                "message": "CRITICAL: Power supply voltage has dropped below safety margin."
            })
        elif cur_power == "Fluctuating":
            severity = "Warning"
            health_score -= 15
            issues.append({
                "parameter": "Power Supply Status",
                "severity": severity,
                "expected": "Stable",
                "current": cur_power,
                "message": "WARNING: Power input fluctuation detected. Clean power filter recommended."
            })

        # Ensure health score is within bounds [0, 100]
        health_score = max(0, min(100, health_score))

        # Determine overall diagnostic status
        # If any Critical issue is present, status is Fault
        # If no Critical but any Warning issue, status is Warning
        # Otherwise, Healthy
        critical_count = sum(1 for issue in issues if issue["severity"] == "Critical")
        warning_count = sum(1 for issue in issues if issue["severity"] == "Warning")

        if critical_count > 0 or health_score < 60:
            status = "Fault"
        elif warning_count > 0 or health_score < 90:
            status = "Warning"
        else:
            status = "Healthy"

        return {
            "status": status,
            "health_score": health_score,
            "issues": issues,
            "metrics": {
                "temperature": cur_temp,
                "power_status": cur_power
            }
        }
