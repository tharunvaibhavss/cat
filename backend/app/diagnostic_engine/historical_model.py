import math
from typing import Dict, Any, List, Optional
from datetime import datetime

class HistoricalDiagnosticModel:
    """
    Intelligent AI Diagnostic Model that compares a machine's historical inspection 
    readings with its current (live or manual) readings against the OEM Specification Audit.
    
    Evaluates:
    - Baseline Specification Audit compliance
    - Historical trend moving averages (Temperature, Pressure, Health)
    - Anomalous deviation rate (Z-score & Delta drift detection)
    - Operational Decision (CONTINUE_OPERATION | PREVENTIVE_MAINTENANCE | CORRECTIVE_MAINTENANCE_IMMEDIATE_STOP)
    """

    @staticmethod
    def evaluate_machine_condition(
        machine_info: Dict[str, Any],
        ref_config: Dict[str, Any],
        curr_config: Dict[str, Any],
        current_health_score: float,
        current_issues: List[Dict[str, Any]],
        history_records: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        
        current_temp = curr_config.get("temperature", 45.0)
        current_power = curr_config.get("power_status", "Stable")
        
        # 1. Historical Sequence Extraction & Moving Averages
        past_temps = [r.get("temperature", 45.0) for r in history_records if r.get("temperature") is not None]
        past_scores = [r.get("health_score", 90.0) for r in history_records if r.get("health_score") is not None]
        
        if not past_temps:
            past_temps = [45.0]
        if not past_scores:
            past_scores = [90.0]

        avg_hist_temp = sum(past_temps) / len(past_temps)
        avg_hist_score = sum(past_scores) / len(past_scores)

        # Standard deviation of temperature history
        variance = sum((t - avg_hist_temp) ** 2 for t in past_temps) / len(past_temps)
        std_temp = math.sqrt(variance) if variance > 0 else 2.0

        # Z-score anomaly metric: how many std deviations current temp is from machine's historical baseline
        temp_z_score = round((current_temp - avg_hist_temp) / std_temp, 2)

        # 2. Rate of Change / Trend Drift (comparing latest to previous historical record)
        prev_temp = past_temps[0] if past_temps else current_temp
        prev_score = past_scores[0] if past_scores else current_health_score
        
        delta_temp = round(current_temp - prev_temp, 1)
        delta_health = round(current_health_score - prev_score, 1)

        # 3. Anomaly Detection Classification
        detected_anomalies = []
        
        if temp_z_score >= 2.0:
            detected_anomalies.append({
                "type": "THERMAL_SPIKE_ANOMALY",
                "severity": "Critical" if temp_z_score >= 3.0 else "Warning",
                "description": f"Operating temperature ({current_temp}°C) is {temp_z_score} standard deviations above historical mean ({round(avg_hist_temp, 1)}°C)."
            })
        elif delta_temp >= 10.0:
            detected_anomalies.append({
                "type": "RAPID_THERMAL_DRIFT",
                "severity": "Warning",
                "description": f"Temperature jumped by +{delta_temp}°C since last inspection cycle."
            })

        if delta_health <= -15.0:
            detected_anomalies.append({
                "type": "ACCELERATED_HEALTH_DECAY",
                "severity": "Critical",
                "description": f"Machine health score dropped by {abs(delta_health)}% in current reading interval."
            })

        if current_power != "Stable":
            detected_anomalies.append({
                "type": "POWER_GRID_INSTABILITY",
                "severity": "Warning" if current_power == "Fluctuating" else "Critical",
                "description": f"Power supply status flagged as {current_power}."
            })

        # 4. Specification Audit Mismatch Count
        spec_mismatch_count = len([i for i in current_issues if i.get("severity") in ["Warning", "Critical"]])
        critical_spec_issues = [i for i in current_issues if i.get("severity") == "Critical"]

        # 5. Determine Operational Recommendation & Maintenance Status
        if current_health_score < 50 or len(critical_spec_issues) > 0 or temp_z_score >= 3.5:
            operational_status = "SCHEDULE_CORRECTIVE_MAINTENANCE_IMMEDIATE_STOP"
            status_display = "IMMEDIATE STOP & CORRECTIVE MAINTENANCE REQUIRED"
            urgency = "Immediate (Within 24 Hours)"
            recommendation = "Safely disengage machine load, isolate master power switch, and perform corrective maintenance immediately."
        elif current_health_score < 85 or len(detected_anomalies) > 0 or spec_mismatch_count > 0:
            operational_status = "SCHEDULE_PREVENTIVE_MAINTENANCE"
            status_display = "SCHEDULE PREVENTIVE MAINTENANCE"
            urgency = "High (Within 7 Days)"
            recommendation = "Schedule preventive maintenance cycle to address identified anomalies, thermal drift, and hardware specification deviations."
        else:
            operational_status = "CONTINUE_OPERATION"
            status_display = "CONTINUE NORMAL OPERATION"
            urgency = "Routine Monitoring"
            recommendation = "Machine is operating within normal parameters and specification baselines. Continue standard operation interval."

        return {
            "operational_status": operational_status,
            "status_display": status_display,
            "urgency": urgency,
            "recommendation": recommendation,
            "health_score": current_health_score,
            "historical_metrics": {
                "historical_avg_temp": round(avg_hist_temp, 1),
                "historical_avg_health": round(avg_hist_score, 1),
                "temp_z_score": temp_z_score,
                "delta_temp": delta_temp,
                "delta_health": delta_health,
                "inspection_count": len(history_records)
            },
            "anomalies": detected_anomalies,
            "spec_audit_mismatch_count": spec_mismatch_count
        }
