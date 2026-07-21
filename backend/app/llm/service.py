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
                
                Perform a root-cause analysis and generate maintenance recommendations based on the following diagnostic mismatch report.
                
                ### MACHINE INFO
                Name: {machine_info.get('name')}
                Model: {machine_info.get('model')}
                Category: {machine_info.get('category')}
                Manufacturer: {machine_info.get('manufacturer')}
                
                ### DIAGNOSTIC RESULTS (JSON)
                {json.dumps(diagnostic_result, indent=2)}
                
                ### REFERENCE CONFIGURATION
                {json.dumps(reference_config, indent=2)}
                
                ### CURRENT HARDWARE CONFIGURATION
                {json.dumps(current_config, indent=2)}
                
                Generate a response containing the following sections. Ensure the tone is highly professional, technical, and safety-oriented. Return the output STRICTLY as a JSON object with the following keys (no markdown formatting around it, just raw JSON):
                {{
                    "machine_health": "Short assessment of overall safety and status",
                    "root_cause_analysis": "Technical explanation of why these mismatches or warnings occurred and their hardware implications",
                    "severity_explanation": "Explain why this severity level (Info/Warning/Critical) was assigned to the issues",
                    "maintenance_recommendation": "Step-by-step physical maintenance steps (e.g. check connection, replace card, restore firmware)",
                    "safety_notes": "Essential safety protocols (LOTO - Lockout/Tagout, PPE) to follow during service",
                    "troubleshooting_steps": "Detailed CLI commands, calibration steps, or diagnostic procedures to verify the fix",
                    "inspection_summary": "Summary of the whole inspection event for archival"
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
        category = machine_info.get("category", "")
        status = diagnostic.get("status", "Healthy")
        health_score = diagnostic.get("health_score", 100)
        issues = diagnostic.get("issues", [])

        # Compile summaries
        if status == "Healthy":
            machine_health = "SYSTEM OPERATIONAL: All physical and logical configurations match the manufacturer's blueprint specifications."
            root_cause = "No configuration deviations detected. Runtime conditions (thermal, power) are within optimal nominal thresholds."
            severity = "Info: System state is within normal operating limits. No intervention required."
            recommendations = "Perform routine scheduled checks according to the Caterpillar OMM (Operation and Maintenance Manual)."
            safety = "Standard workshop safety protocols apply. No active electrical or structural work required."
            troubleshooting = "Review diagnostic logs weekly. Maintain routine filters and fluid analysis (S·O·S fluid analysis for CAT excavators/loaders)."
            summary = "Routine check completed. Configuration matched 100% against reference profile."
        else:
            issue_summary_list = [f"- {iss['parameter']}: {iss['message']}" for iss in issues]
            issues_str = "\n".join(issue_summary_list)
            
            machine_health = f"DEGRADED / ACTION REQUIRED (Health: {health_score}%): Mismatches or anomalous sensor readings detected. Operational risks present."
            root_cause = f"The diagnostic engine flagged the following configuration mismatches:\n{issues_str}\n\nTypical root causes include: field component replacement with unauthorized modules, out-of-date PLC programming flashes, firmware regression during maintenance cycles, or thermal cooling degradation."
            
            severity = "Multiple parameters violate operational baselines. Mismatches in critical modules can trigger safety locks or invalid telemetry loops on the master PLC system."
            
            # Formulate action steps depending on what failed
            rec_steps = []
            ts_steps = []
            safety_precautions = ["Verify power source disconnect before opening PLC enclosures."]
            
            has_temp = any(i["parameter"] == "Operating Temperature" for i in issues)
            has_fw = any(i["parameter"] in ["Firmware Version", "PLC Version"] for i in issues)
            has_hw = any(i["parameter"] in ["CPU Architecture", "RAM (Memory)", "Storage", "Installed Modules"] for i in issues)
            has_power = any(i["parameter"] == "Power Supply Status" for i in issues)

            if has_temp:
                rec_steps.append("Flush cooling heat-exchanger. Check coolant levels, auxiliary radiator fans, and verify hydraulic oil thermal status.")
                ts_steps.append("Calibrate thermistor sensors using an external infrared thermometer. Verify radiator fan relay controls.")
                safety_precautions.append("WARNING: High temperature components! Allow machine to idle and cool down for 20 minutes before inspecting thermal zones.")

            if has_fw:
                rec_steps.append("Connect Service Tool (CAT ET or Siemens TIA Portal) and flash target firmware and PLC image profiles matching reference configurations.")
                ts_steps.append("Run firmware CRC checksum validation command. Check serial console output for boot loader warnings.")
                safety_precautions.append("Ensure constant power backup is connected to the PLC logic controllers during the programming and flashing sequence.")

            if has_hw:
                rec_steps.append("Audit active hardware modules. Replace generic CPU boards, RAM modules, or expansion cards with OEM-authorized parts.")
                ts_steps.append("Perform full system diagnostic self-test from the service shell. Verify device tree registration of all local modules.")
                safety_precautions.append("Follow Electrostatic Discharge (ESD) wrist strap procedures when handling exposed logic boards or memory chips.")

            if has_power:
                rec_steps.append("Check supply transformer lines, inspect local power filter capacitor banks, and verify voltage regulator calibration.")
                ts_steps.append("Use digital multimeter to measure main 24V DC bus voltage at full load and trace voltage drops.")
                safety_precautions.append("CRITICAL ELECTRICAL HAZARD: Wear insulated high-voltage gloves (Class 0) if measuring terminal rails directly.")

            if not rec_steps:
                rec_steps.append("Perform manual review of local interface and verify connectivity configurations.")
                ts_steps.append("Restart local CPU unit and rerun diagnostics.")

            recommendations = "\n".join([f"{i+1}. {step}" for i, step in enumerate(rec_steps)])
            safety = "\n".join([f"- {s}" for s in safety_precautions])
            troubleshooting = "\n".join([f"{i+1}. {step}" for i, step in enumerate(ts_steps)])
            summary = f"Completed diagnostic evaluation of {machine_info.get('name')} ({machine_info.get('model')}). Identified {len(issues)} configuration mismatch(es) resulting in a {status} designation."

        return {
            "machine_health": machine_health,
            "root_cause_analysis": root_cause,
            "severity_explanation": severity,
            "maintenance_recommendation": recommendations,
            "safety_notes": safety,
            "troubleshooting_steps": troubleshooting,
            "inspection_summary": summary
        }
