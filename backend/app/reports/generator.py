import os
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.pdfgen import canvas
from typing import Dict, Any, List

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to add footers with dynamic page counts ('Page X of Y').
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#666666"))
        
        # Header
        self.setStrokeColor(colors.HexColor("#CCCCCC"))
        self.setLineWidth(0.5)
        self.line(54, 750, 558, 750)
        self.drawString(54, 755, "CATERPILLAR® INDUSTRIAL SERVICES - DIAGNOSTIC REPORT")
        
        # Footer
        self.line(54, 50, 558, 50)
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 35, page_text)
        
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.drawString(54, 35, f"CONFIDENTIAL | SYSTEM DIAGNOSIS TIME: {timestamp}")
        self.restoreState()


class ReportGenerator:
    @staticmethod
    def generate_pdf(
        file_path: str,
        machine_info: Dict[str, Any],
        reference_config: Dict[str, Any],
        current_config: Dict[str, Any],
        diagnostic_result: Dict[str, Any],
        llm_analysis: Dict[str, str],
        engineer_name: str
    ) -> str:
        """
        Generates a professional engineering report and saves it to the specified file_path.
        """
        # Ensure target folder exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        doc = SimpleDocTemplate(
            file_path,
            pagesize=letter,
            leftMargin=54,
            rightMargin=54,
            topMargin=72,
            bottomMargin=72
        )

        styles = getSampleStyleSheet()
        
        # Custom styles matching CAT branding
        # Caterpillar Yellow: #FFCC00, Dark Charcoal: #1E1E1E
        cat_yellow = colors.HexColor("#FFCC00")
        cat_dark = colors.HexColor("#222222")
        alert_red = colors.HexColor("#D32F2F")
        alert_orange = colors.HexColor("#EF6C00")
        alert_green = colors.HexColor("#2E7D32")
        
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=cat_dark,
            spaceAfter=15
        )

        h1_style = ParagraphStyle(
            "SectionH1",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=cat_dark,
            backColor=colors.HexColor("#F0F0F0"),
            borderPadding=6,
            spaceBefore=15,
            spaceAfter=10,
            keepWithNext=True
        )

        h2_style = ParagraphStyle(
            "SectionH2",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#333333"),
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True
        )

        body_style = ParagraphStyle(
            "ReportBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#333333"),
            spaceAfter=6
        )

        bullet_style = ParagraphStyle(
            "ReportBullet",
            parent=body_style,
            leftIndent=15,
            firstLineIndent=-10,
            spaceAfter=4
        )

        code_style = ParagraphStyle(
            "ReportCode",
            parent=styles["Normal"],
            fontName="Courier",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#1A1A1A"),
            backColor=colors.HexColor("#F8F9FA"),
            borderPadding=4,
            spaceAfter=6
        )

        story = []

        # 1. Main Title Header (simulated logo / colored stripe)
        header_data = [
            [Paragraph("<b>CAT® SERVICE PORTAL</b>", ParagraphStyle("HLogo", parent=body_style, fontSize=16, leading=18, textColor=colors.white)), ""],
            [Paragraph("SYSTEM DIAGNOSTIC REPORT", title_style), ""]
        ]
        
        # Color bar
        header_table = Table([[ "" ]], colWidths=[504], rowHeights=[10])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), cat_yellow),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        
        story.append(Paragraph("<b>CATERPILLAR® MACHINE DIAGNOSTICS</b>", ParagraphStyle("CATBrand", parent=body_style, fontSize=12, leading=14, textColor=cat_dark)))
        story.append(header_table)
        story.append(Spacer(1, 10))
        story.append(Paragraph("INDUSTRIAL INSPECTION & SYSTEM CONFIGURATION AUDIT", title_style))
        story.append(Spacer(1, 5))

        # 2. Metadata Block (Table format)
        meta_data = [
            [
                Paragraph("<b>Machine ID:</b>", body_style), Paragraph(machine_info.get("machine_id", "N/A"), body_style),
                Paragraph("<b>Date of Inspection:</b>", body_style), Paragraph(datetime.datetime.now().strftime("%Y-%m-%d"), body_style)
            ],
            [
                Paragraph("<b>Machine Name:</b>", body_style), Paragraph(machine_info.get("name", "N/A"), body_style),
                Paragraph("<b>Lead Engineer:</b>", body_style), Paragraph(engineer_name, body_style)
            ],
            [
                Paragraph("<b>Manufacturer:</b>", body_style), Paragraph(machine_info.get("manufacturer", "N/A"), body_style),
                Paragraph("<b>Model / Category:</b>", body_style), Paragraph(f"{machine_info.get('model', '')} / {machine_info.get('category', '')}", body_style)
            ],
            [
                Paragraph("<b>Diagnostic Status:</b>", body_style), 
                Paragraph(f"<b>{diagnostic_result.get('status', 'Unknown')}</b> (Score: {diagnostic_result.get('health_score', 0)}%)", ParagraphStyle("StatusTxt", parent=body_style, textColor=alert_red if diagnostic_result.get('status') == 'Fault' else alert_orange if diagnostic_result.get('status') == 'Warning' else alert_green)),
                Paragraph("<b>Engine Version:</b>", body_style), Paragraph("v2.4-deterministic", body_style)
            ]
        ]
        
        meta_table = Table(meta_data, colWidths=[100, 152, 110, 142])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8F9FA")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 15))

        # 3. Configuration Comparison Table
        story.append(Paragraph("System Hardware & Firmware Configuration Audit", h1_style))
        story.append(Paragraph("Below is a side-by-side comparison of the active telemetry and local software modules against original factory reference parameters.", body_style))
        story.append(Spacer(1, 5))

        # Build comparison grid
        comp_data = [
            [
                Paragraph("<b>Parameter</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
                Paragraph("<b>Factory Reference</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
                Paragraph("<b>Current Machine</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
                Paragraph("<b>Audit Status</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white))
            ]
        ]

        def get_audit_badge(param_name: str) -> Paragraph:
            for iss in diagnostic_result.get("issues", []):
                if iss["parameter"].lower() == param_name.lower() or (param_name == "Operating Temperature" and iss["parameter"] == "Operating Temperature"):
                    sev = iss["severity"]
                    return Paragraph(f"<font color='{alert_red.hexval() if sev=='Critical' else alert_orange.hexval()}'><b>MISMATCH ({sev.upper()})</b></font>", body_style)
            return Paragraph("<font color='green'><b>MATCHED</b></font>", body_style)

        # Main configuration keys to list
        config_rows = [
            ("Firmware Version", reference_config.get("firmware"), current_config.get("firmware")),
            ("PLC Version", reference_config.get("plc_version"), current_config.get("plc_version")),
            ("CPU Architecture", reference_config.get("cpu"), current_config.get("cpu")),
            ("RAM (Memory)", reference_config.get("ram"), current_config.get("ram")),
            ("Storage", reference_config.get("storage"), current_config.get("storage")),
            ("Sensor Count", str(reference_config.get("sensor_count")), str(current_config.get("sensor_count"))),
            ("Communication Ports", ", ".join(reference_config.get("communication_ports", [])), ", ".join(current_config.get("communication_ports", []))),
            ("Installed Modules", ", ".join(reference_config.get("installed_modules", [])), ", ".join(current_config.get("installed_modules", []))),
            ("Operating Temperature", "Under 70 C", f"{current_config.get('temperature', 45.0)} C"),
            ("Power Supply Status", "Stable", current_config.get("power_status", "Stable")),
        ]

        for label, ref_val, cur_val in config_rows:
            comp_data.append([
                Paragraph(label, body_style),
                Paragraph(str(ref_val), body_style),
                Paragraph(str(cur_val), body_style),
                get_audit_badge(label)
            ])

        comp_table = Table(comp_data, colWidths=[120, 130, 130, 124])
        comp_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), cat_dark),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CCCCCC")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9FAFB")]),
        ]))
        story.append(comp_table)
        story.append(Spacer(1, 15))

        # 4. Detected Mismatches & Fault Log
        if diagnostic_result.get("issues"):
            issue_block = []
            issue_block.append(Paragraph("Detected Mismatches & Anomalies", h1_style))
            for i, iss in enumerate(diagnostic_result.get("issues", [])):
                sev_color = alert_red.hexval() if iss["severity"] == "Critical" else alert_orange.hexval() if iss["severity"] == "Warning" else "#1F2937"
                issue_block.append(Paragraph(
                    f"<b>{i+1}. {iss['parameter']} Mismatch [<font color='{sev_color}'>{iss['severity'].upper()}</font>]</b>",
                    h2_style
                ))
                issue_block.append(Paragraph(iss["message"], body_style))
                issue_block.append(Spacer(1, 3))
            story.append(KeepTogether(issue_block))
            story.append(Spacer(1, 10))

        # 5. AI Maintenance & Root Cause Analysis
        ai_block = []
        ai_block.append(Paragraph("AI-Powered Diagnostics Analysis", h1_style))
        
        ai_block.append(Paragraph("Machine Safety & Health Assessment", h2_style))
        ai_block.append(Paragraph(llm_analysis.get("machine_health", "N/A"), body_style))
        
        ai_block.append(Paragraph("Root Cause Analysis", h2_style))
        ai_block.append(Paragraph(llm_analysis.get("root_cause_analysis", "N/A"), body_style))

        ai_block.append(Paragraph("Suggested Maintenance Worksteps", h2_style))
        recs = llm_analysis.get("maintenance_recommendation", "").split("\n")
        for rec in recs:
            if rec.strip():
                ai_block.append(Paragraph(rec, bullet_style))

        ai_block.append(Paragraph("Crucial Safety Notes", h2_style))
        safeties = llm_analysis.get("safety_notes", "").split("\n")
        for s in safeties:
            if s.strip():
                ai_block.append(Paragraph(s, bullet_style))

        ai_block.append(Paragraph("Verification & Troubleshooting Steps", h2_style))
        ts = llm_analysis.get("troubleshooting_steps", "").split("\n")
        for step in ts:
            if step.strip():
                ai_block.append(Paragraph(step, bullet_style))

        story.append(KeepTogether(ai_block))
        story.append(Spacer(1, 20))

        # 6. Engineer Signature Panel
        sig_data = [
            [
                Paragraph("<b>PREPARED BY:</b>", body_style),
                Paragraph("<b>REVIEWED & SIGNED BY:</b>", body_style)
            ],
            [
                Paragraph("<br/><br/>________________________________________<br/>Automated Diagnostic Engine<br/>CAT Diagnostic Systems", body_style),
                Paragraph(f"<br/><br/>________________________________________<br/>Lead Engineer: {engineer_name}<br/>CAT Certified Field Inspector", body_style)
            ]
        ]
        sig_table = Table(sig_data, colWidths=[252, 252])
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('PADDING', (0,0), (-1,-1), 10),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8F9FA")),
            ('LINEABOVE', (0,0), (-1,0), 1, colors.HexColor("#CCCCCC")),
        ]))
        
        story.append(KeepTogether(sig_table))

        # Build PDF using our custom NumberedCanvas
        doc.build(story, canvasmaker=NumberedCanvas)
        return file_path
