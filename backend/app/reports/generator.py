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

        # 3. Factory Reference Blueprint Specifications Table (Requirement 2)
        story.append(Paragraph("Factory Reference Blueprint Specifications", h1_style))
        story.append(Paragraph("Below is the OEM baseline factory reference configuration for this equipment model.", body_style))
        story.append(Spacer(1, 5))

        # Build 2-column Factory Reference table
        comp_data = [
            [
                Paragraph("<b>Specification Parameter</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
                Paragraph("<b>Factory Reference Blueprint</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white))
            ]
        ]

        config_rows = [
            ("Firmware Version Profile", str(reference_config.get("firmware", "N/A"))),
            ("PLC Logic Controller Version", str(reference_config.get("plc_version", "N/A"))),
            ("CPU Architecture", str(reference_config.get("cpu", "N/A"))),
            ("RAM System Memory", str(reference_config.get("ram", "N/A"))),
            ("Secondary Storage", str(reference_config.get("storage", "N/A"))),
            ("OEM Sensor Nodes Count", f"{reference_config.get('sensor_count', 0)} active nodes"),
            ("Communication Ports", ", ".join(reference_config.get("communication_ports", [])) if isinstance(reference_config.get("communication_ports"), list) else str(reference_config.get("communication_ports", "N/A"))),
            ("Installed Modules", ", ".join(reference_config.get("installed_modules", [])) if isinstance(reference_config.get("installed_modules"), list) else str(reference_config.get("installed_modules", "N/A"))),
        ]

        for label, ref_val in config_rows:
            comp_data.append([
                Paragraph(label, body_style),
                Paragraph(ref_val, body_style)
            ])

        comp_table = Table(comp_data, colWidths=[200, 304])
        comp_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), cat_dark),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CCCCCC")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9FAFB")]),
        ]))
        story.append(comp_table)
        story.append(Spacer(1, 15))

        # 3b. Real-Time Telemetry & Historical Audit Table
        telemetry_comp = diagnostic_result.get("telemetry_comparison")
        if telemetry_comp:
            story.append(Paragraph("Real-Time Telemetry & Historical Audit", h1_style))
            story.append(Paragraph("Side-by-side analysis of real-time telemetry metrics against design baseline standards and historical values from previous logs.", body_style))
            story.append(Spacer(1, 5))

            tel_data = [
                [
                    Paragraph("<b>Telemetry Parameter</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
                    Paragraph("<b>Design Baseline</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
                    Paragraph("<b>Real-Time Value</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
                    Paragraph("<b>Previous Value</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white)),
                    Paragraph("<b>Status</b>", ParagraphStyle("TH", parent=body_style, fontName="Helvetica-Bold", textColor=colors.white))
                ]
            ]

            for item in telemetry_comp:
                status_str = item.get("status", "Matched")
                if status_str == "Critical":
                    status_para = Paragraph(f"<font color='{alert_red.hexval()}'><b>CRITICAL</b></font>", body_style)
                elif status_str == "Warning":
                    status_para = Paragraph(f"<font color='{alert_orange.hexval()}'><b>WARNING</b></font>", body_style)
                elif status_str == "Matched":
                    status_para = Paragraph(f"<font color='{alert_green.hexval()}'><b>NOMINAL</b></font>", body_style)
                else:
                    status_para = Paragraph(f"<font color='#555555'><b>INFO</b></font>", body_style)

                tel_data.append([
                    Paragraph(item.get("parameter", ""), body_style),
                    Paragraph(item.get("normal", ""), body_style),
                    Paragraph(item.get("realtime", ""), body_style),
                    Paragraph(item.get("old", ""), body_style),
                    status_para
                ])

            tel_table = Table(tel_data, colWidths=[120, 100, 100, 100, 84])
            tel_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), cat_dark),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CCCCCC")),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('PADDING', (0,0), (-1,-1), 5),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9FAFB")]),
            ]))
            story.append(tel_table)
            story.append(Spacer(1, 15))

            observations = diagnostic_result.get("observations")
            if observations and observations != "None":
                obs_block = []
                obs_block.append(Paragraph("<b>Operator Observations:</b>", h2_style))
                obs_block.append(Paragraph(f"<i>\"{observations}\"</i>", body_style))
                story.append(KeepTogether(obs_block))
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
