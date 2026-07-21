from typing import Dict, Any, List

class PredictiveEngine:
    @staticmethod
    def calculate_predictive_metrics(machine_data: Dict[str, Any], current_config: Dict[str, Any], diagnostic_result: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Predictive Maintenance & Remaining Useful Life (RUL) estimation engine.
        Evaluates operating hours, thermal load history, configuration drift, and sensor degradation.
        """
        operating_hours = machine_data.get("operating_hours", 1200.0)
        temp = current_config.get("temperature", 45.0) if current_config else 45.0
        power_status = current_config.get("power_status", "Stable") if current_config else "Stable"
        health_score = diagnostic_result.get("health_score", 90) if diagnostic_result else 90

        # Baseline RUL lifecycle for heavy machinery (typical overhaul cycle = 10,000 hours)
        max_lifecycle_hours = 10000.0
        base_rul = max(0.0, max_lifecycle_hours - operating_hours)

        # Degradation factor calculation
        degradation_factor = 1.0

        if temp >= 90.0:
            degradation_factor += 0.45
        elif temp >= 75.0:
            degradation_factor += 0.20

        if power_status == "Low Voltage":
            degradation_factor += 0.35
        elif power_status == "Fluctuating":
            degradation_factor += 0.15

        if health_score < 60:
            degradation_factor += 0.50
        elif health_score < 85:
            degradation_factor += 0.20

        # Calculate adjusted RUL
        rul_hours = round(max(50.0, base_rul / degradation_factor), 1)

        # Calculate component breakdown risk probabilities (%)
        engine_risk = min(99.0, round((operating_hours / 100.0) * 0.8 + (temp - 40.0) * 0.9, 1))
        hydraulic_risk = min(99.0, round((operating_hours / 120.0) * 0.7 + (100 - health_score) * 0.6, 1))
        electrical_risk = min(99.0, round(30.0 if power_status != "Stable" else 5.0 + (operating_hours / 200.0), 1))
        transmission_risk = min(99.0, round((operating_hours / 150.0) * 0.65, 1))

        # Overall failure probability
        overall_risk = min(99.0, round(max(engine_risk, hydraulic_risk, electrical_risk, transmission_risk), 1))

        # Determine maintenance priority & timeframe
        if overall_risk > 75.0 or rul_hours < 250.0:
            priority = "Critical"
            suggested_action = "Schedule Immediate Service (within 24-48 hours)"
        elif overall_risk > 45.0 or rul_hours < 1000.0:
            priority = "High"
            suggested_action = "Schedule Service within 7 Days"
        elif overall_risk > 20.0 or rul_hours < 2500.0:
            priority = "Medium"
            suggested_action = "Schedule Routine Service within 30 Days"
        else:
            priority = "Low"
            suggested_action = "Continue Standard Maintenance Interval"

        return {
            "rul_hours": rul_hours,
            "overall_risk_score": overall_risk,
            "priority": priority,
            "suggested_action": suggested_action,
            "component_risk": {
                "engine": max(1.0, engine_risk),
                "hydraulics": max(1.0, hydraulic_risk),
                "electrical": max(1.0, electrical_risk),
                "transmission": max(1.0, transmission_risk)
            }
        }
