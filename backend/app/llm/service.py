import os
import json
from openai import OpenAI
from typing import Dict, Any

class LLMService:
    @staticmethod
    def analyze_diagnostics(machine_info: Dict[str, Any], reference_config: Dict[str, Any], current_config: Dict[str, Any], diagnostic_result: Dict[str, Any]) -> Dict[str, str]:
        """
        Submits configuration mismatches to OpenAI (GPT-4o/5.5) for structural root-cause analysis
        and maintenance workflow compilation. If OPENAI_API_KEY is not set, it executes a local
        deterministic rule-based explainer as a fallback.
        """
        api_key = os.getenv("OPENAI_API_KEY")
        
        # If API key is available, attempt connection to OpenAI
        if api_key:
            try:
                client = OpenAI(api_key=api_key)
                
                prompt = f"""
                You are a senior industrial hardware systems engineer and diagnostic expert for Caterpillar (CAT) and Siemens machinery.
                
                Perform a root-cause analysis and generate maintenance recommendations based strictly on the following Real-Time Telemetry, Historical Audit, and Sensor parameters. Do NOT perform hardware blueprint audit comparisons.
                
                ### MACHINE INFO
                Name: {machine_info.get('name')}
                Model: {machine_info.get('model')}
                Category: {machine_info.get('category')}
                Manufacturer: {machine_info.get('manufacturer')}
                
                ### REAL-TIME TELEMETRY & HISTORICAL AUDIT RESULTS (JSON)
                {json.dumps(diagnostic_result, indent=2)}
                
                ### FACTORY REFERENCE SPECIFICATIONS (REFERENCE ONLY)
                {json.dumps(reference_config, indent=2)}
                
                Generate a response containing the following sections. Ensure the tone is highly professional, technical, and safety-oriented. Return the output STRICTLY as a JSON object with the following keys (no markdown formatting around it, just raw JSON):
                {{
                    "machine_health": "Short assessment of overall telemetry safety and status",
                    "root_cause_analysis": "Technical explanation of real-time sensor anomalies, operating trends, and historical deviations",
                    "severity_explanation": "Explain why this severity level (Info/Warning/Critical) was assigned to telemetry readings",
                    "maintenance_recommendation": "Step-by-step physical maintenance steps (e.g. check fluid levels, inspect cooling loop, test sensors)",
                    "safety_notes": "Essential safety protocols (LOTO - Lockout/Tagout, PPE) to follow during service",
                    "troubleshooting_steps": "Detailed sensor calibration steps, pressure checks, or diagnostic procedures to verify the fix",
                    "inspection_summary": "Summary of the telemetry inspection event for archival"
                }}
                """
                
                response = client.chat.completions.create(
                    model="gpt-4o",  # or gpt-4o-mini, fallback to standard gpt-4o
                    messages=[
                        {"role": "system", "content": "You are a professional industrial systems engineering analyzer. Return only structured JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2
                )
                
                result_text = response.choices[0].message.content
                return json.loads(result_text)
            except Exception as e:
                # Fallback to local template-based explainer on API failure
                print(f"LLM Service Error, falling back to local model: {e}")
                pass

        # Local fallback implementation
        return LLMService._generate_local_analysis(machine_info, diagnostic_result)

    @staticmethod
    def _generate_local_analysis(machine_info: Dict[str, Any], diagnostic: Dict[str, Any]) -> Dict[str, str]:
        status = diagnostic.get("status", "Healthy")
        health_score = diagnostic.get("health_score", 100)
        issues = diagnostic.get("issues", [])
        telemetry_comp = diagnostic.get("telemetry_comparison", [])
        observations = diagnostic.get("observations", "None")

        non_nominal_telemetry = [t for t in telemetry_comp if t.get("status") in ["Warning", "Critical"]]
        
        # Compile summaries
        if status == "Healthy" and not issues and not non_nominal_telemetry:
            machine_health = f"SYSTEM OPERATIONAL (Health: {health_score}% - HEALTHY): All real-time telemetry parameters and hardware blueprint configurations match manufacturer specifications."
            root_cause = "No configuration or telemetry deviations detected. Real-time sensor readings (Engine Temperature, Battery Voltage, Oil Pressure, Hydraulic Pressure) are within nominal thresholds."
            severity = "Nominal: All parameters are strictly within normal operating baselines."
            recommendations = "Perform routine scheduled maintenance according to Caterpillar Operation & Maintenance Manual (OMM)."
            safety = "Standard shop safety protocols apply (PPE, standard lockout/tagout during routine service)."
            troubleshooting = "Review telemetry logs weekly. Perform scheduled S·O·S fluid sampling."
            summary = f"Routine inspection completed for {machine_info.get('name')} ({machine_info.get('model')}). 100% baseline match."
        else:
            issue_summary_list = [f"- {iss['parameter']}: {iss['message']}" for iss in issues]
            issues_str = "\n".join(issue_summary_list) if issue_summary_list else "No blueprint mismatches."
            
            telemetry_str_list = [f"- {t['parameter']}: {t['realtime']} (Normal: {t['normal']}, Status: {t['status']})" for t in telemetry_comp if t.get("status") in ["Warning", "Critical"]]
            telemetry_summary = "\n".join(telemetry_str_list) if telemetry_str_list else "All real-time telemetry parameters within nominal ranges."

            obs_txt = f"\nOperator Observations: '{observations}'" if observations and observations != "None" else ""

            machine_health = f"ACTION REQUIRED (Health: {health_score}% - {status.upper()}): Real-time telemetry anomalies or configuration mismatches recorded.{obs_txt}"
            
            root_cause = f"REAL-TIME TELEMETRY & HISTORICAL AUDIT ANALYSIS:\n{telemetry_summary}\n\nHARDWARE & SPECIFICATION AUDIT:\n{issues_str}\n\nROOT CAUSE DIAGNOSIS:\nReal-time sensor telemetry and audit logs indicate operational drift or hardware specification mismatch."
            
            severity = f"Severity: {status.upper()} level assigned. Parameters violate nominal operating safety envelopes. Continued unmitigated operation risks component degradation or emergency shutdown."
            
            # Formulate targeted action steps based on actual issues and telemetry
            rec_steps = []
            ts_steps = []
            safety_precautions = ["Verify master disconnect power isolation before inspecting electrical or hydraulic enclosures."]
            
            has_temp = any(i.get("parameter") in ["Engine Temperature", "Operating Temperature"] for i in issues) or any(t.get("parameter") == "Engine Temperature" and t.get("status") != "Matched" for t in telemetry_comp)
            has_battery = any(i.get("parameter") in ["Battery Voltage", "Power Supply Status"] for i in issues) or any(t.get("parameter") == "Battery Voltage" and t.get("status") != "Matched" for t in telemetry_comp)
            has_oil = any(i.get("parameter") == "Oil Pressure" for i in issues) or any(t.get("parameter") == "Oil Pressure" and t.get("status") != "Matched" for t in telemetry_comp)
            has_hyd = any(i.get("parameter") == "Hydraulic Pressure" for i in issues) or any(t.get("parameter") == "Hydraulic Pressure" and t.get("status") != "Matched" for t in telemetry_comp)
            has_codes = any(i.get("parameter") == "Diagnostic Code" for i in issues) or any(t.get("parameter") == "Error Codes" and t.get("status") != "Matched" for t in telemetry_comp)
            has_fw = any(i.get("parameter") in ["Firmware Version", "PLC Version"] for i in issues)
            has_hw = any(i.get("parameter") in ["CPU Architecture", "RAM (Memory)", "Storage", "Installed Modules", "Sensor Count"] for i in issues)

            if has_temp:
                rec_steps.append("Flush engine radiator & heat exchanger. Inspect coolant fill levels, water pump belt tension, and radiator fan shroud.")
                ts_steps.append("Calibrate thermistor sensor using calibrated infrared thermal camera. Verify thermostat opening temperature (82°C-85°C).")
                safety_precautions.append("CAUTION: Thermal Hazard! Allow engine and coolant lines to idle and cool down prior to cap removal.")

            if has_battery:
                rec_steps.append("Test battery cell voltage under load. Inspect alternator charging current and clean battery terminal connections.")
                ts_steps.append("Use digital multimeter to measure 24V DC bus voltage drop under full starter motor crank.")
                safety_precautions.append("ELECTRICAL HAZARD: Wear insulated gloves when checking battery terminals and high-current relays.")

            if has_oil:
                rec_steps.append("Check engine oil level and viscosity. Inspect oil filter housing and oil pump relief valve assembly.")
                ts_steps.append("Attach mechanical pressure gauge to oil gallery test port to verify electronic sensor accuracy.")
                safety_precautions.append("Hot oil under pressure! Ensure oil gallery ports are depressurized before connecting test fittings.")

            if has_hyd:
                rec_steps.append("Inspect hydraulic fluid level in sight glass. Check hydraulic pump manifold relief valves and filter differential pressure.")
                ts_steps.append("Perform hydraulic flow test on main pump circuit. Verify pilot valve pressure regulator setting.")
                safety_precautions.append("HIGH-PRESSURE FLUID INJECTION RISK: Depressurize hydraulic accumulators before loosening hydraulic lines.")

            if has_codes:
                rec_steps.append("Connect CAT Electronic Technician (CAT ET) or diagnostic scanner to clear ECU fault codes after servicing.")
                ts_steps.append("Read active and logged DTC error codes. Perform wiring harness pinout continuity checks.")

            if has_fw:
                rec_steps.append("Flash target OEM firmware and PLC software version using authorized Caterpillar service tool.")
                ts_steps.append("Verify flash memory checksum CRC. Confirm PLC communication parameters.")

            if has_hw:
                rec_steps.append("Replace non-matching or generic components with OEM-certified hardware modules.")
                ts_steps.append("Perform full device tree registration scan in service console.")

            if not rec_steps:
                rec_steps.append("Perform comprehensive manual inspection of machine components and verify sensor calibration.")
                ts_steps.append("Rerun diagnostic bench verification cycle.")

            recommendations = "\n".join([f"{i+1}. {step}" for i, step in enumerate(rec_steps)])
            safety = "\n".join([f"- {s}" for s in safety_precautions])
            troubleshooting = "\n".join([f"{i+1}. {step}" for i, step in enumerate(ts_steps)])
            summary = f"Completed Real-Time Telemetry & Historical Audit for {machine_info.get('name')} ({machine_info.get('model')}). Diagnostic Status: {status.upper()} (Health Score: {health_score}%)."

        return {
            "machine_health": machine_health,
            "root_cause_analysis": root_cause,
            "severity_explanation": severity,
            "maintenance_recommendation": recommendations,
            "safety_notes": safety,
            "troubleshooting_steps": troubleshooting,
            "inspection_summary": summary
        }
