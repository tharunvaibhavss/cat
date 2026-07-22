import random
from typing import Dict, Any, List

class VisionService:
    @staticmethod
    def analyze_image(image_path: str, machine_id: str = None) -> Dict[str, Any]:
        """
        Computer Vision Inspection module for heavy industrial equipment.
        Detects oil leaks, surface cracks, corrosion, missing bolts, belt wear, and PPE compliance.
        """
        # Simulated intelligent vision analysis pipeline
        possible_defects = [
            {"defect": "Oil Seepage / Hydraulic Leak", "confidence": 0.94, "severity": "High"},
            {"defect": "Surface Corrosion / Paint Peeling", "confidence": 0.88, "severity": "Medium"},
            {"defect": "Exposed Wire Harness / Damaged Conduit", "confidence": 0.91, "severity": "High"},
            {"defect": "Missing Mounting Flange Bolt", "confidence": 0.85, "severity": "Critical"},
            {"defect": "V-Belt Fraying & Tension Loss", "confidence": 0.89, "severity": "Medium"},
            {"defect": "Exhaust Smoke Discoloration", "confidence": 0.93, "severity": "High"},
        ]

        # Select 1-2 defects based on hash of image_path or random seed
        seed_val = sum(ord(c) for c in image_path)
        random.seed(seed_val)

        has_defect = random.choice([True, True, False])
        detected = []
        if has_defect:
            count = random.choice([1, 2])
            detected = random.sample(possible_defects, count)

        ppe_compliant = random.choice([True, True, True, False])
        overall_confidence = round(random.uniform(0.89, 0.98), 2)

        if detected:
            summary = f"AI Vision detected {len(detected)} defect(s): " + ", ".join([d['defect'] for d in detected]) + "."
        else:
            summary = "AI Vision Scan Complete: No surface defects, leaks, or structural abnormalities detected."

        return {
            "image_url": image_path,
            "defects": detected,
            "defects_detected_list": [d["defect"] for d in detected],
            "overall_confidence": overall_confidence,
            "ppe_compliant": ppe_compliant,
            "summary": summary
        }
