import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import datetime

def send_risk_alert_email(recipient_emails: list[str], machine_info: dict, diagnostic_result: dict):
    """
    Formats and dispatches an enterprise-grade HTML alert email.
    If local SMTP is not configured or throws an error, it logs the HTML body to static file path
    for verification/testing in development.
    """
    # 1. Load SMTP settings from Environment (.env)
    smtp_host = os.getenv("SMTP_HOST", "localhost")
    try:
        smtp_port = int(os.getenv("SMTP_PORT", "1025"))
    except ValueError:
        smtp_port = 1025
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", "alerts@cat-diagnostics.com")

    # 2. Extract alert details
    machine_id = machine_info.get("machine_id", "UNKNOWN-ID")
    machine_name = machine_info.get("name", "Unknown Machinery")
    machine_model = machine_info.get("model", "N/A")
    health_score = diagnostic_result.get("health_score", 0)
    status = diagnostic_result.get("status", "Fault")
    issues = diagnostic_result.get("details", {}).get("issues", [])
    timestamp_str = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    # 3. Build HTML Message Body
    issues_html = ""
    if issues:
        for issue in issues:
            issues_html += f"""
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; font-weight: bold; color: #7f1d1d; text-transform: uppercase; font-family: monospace;">{issue.get('parameter', 'Mismatch')}</td>
                <td style="padding: 10px; color: #dc2626; font-weight: bold; font-family: monospace;">{issue.get('severity', 'Critical')}</td>
                <td style="padding: 10px; color: #4b5563;">{issue.get('message', '')}</td>
            </tr>
            """
    else:
        issues_html = """
        <tr>
            <td colspan="3" style="padding: 15px; text-align: center; color: #4b5563;">No specific system mismatch codes parsed.</td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>CRITICAL RISK ALERT - CAT DIAGNOSTICS</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 20px;">
            <tr>
                <td align="center">
                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <!-- Header Banner -->
                        <tr style="background-color: #111111; color: #ffffff;">
                            <td style="padding: 24px 30px; border-bottom: 4px solid #FFCC00;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td>
                                            <span style="font-size: 24px; font-weight: 900; letter-spacing: 2px;">CAT</span>
                                            <span style="font-size: 16px; font-weight: bold; color: #FFCC00; margin-left: 10px; letter-spacing: 1px; text-transform: uppercase;">Diagnostics Gateway</span>
                                        </td>
                                        <td align="right">
                                            <span style="background-color: #dc2626; color: #ffffff; font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 3px; font-family: monospace;">CRITICAL CRASH RISK</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td style="padding: 30px;">
                                <h2 style="margin-top: 0; color: #111827; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Machinery Health Compromised (&ge;80% Risk)</h2>
                                <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
                                    An automated diagnostic checking run has detected critical mismatches on the connected machinery listed below. A high-risk alarm has been triggered. Please schedule immediate engineering intervention.
                                </p>

                                <!-- Machine Details Card -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 15px; margin: 20px 0;">
                                    <tr>
                                        <td width="50%" style="padding: 5px; font-size: 12px; color: #6b7280; font-weight: bold; uppercase;">Machine Profile ID</td>
                                        <td width="50%" style="padding: 5px; font-size: 12px; color: #6b7280; font-weight: bold; uppercase;">Unit Health Score</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 5px; font-size: 16px; font-weight: bold; color: #111827; font-family: monospace;">{machine_id}</td>
                                        <td style="padding: 5px; font-size: 24px; font-weight: 900; color: #dc2626;">{health_score}%</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 5px 5px 0 5px; font-size: 13px; color: #4b5563;">{machine_name} (Model: {machine_model})</td>
                                        <td style="padding: 5px 5px 0 5px; font-size: 12px; color: #ef4444; font-weight: bold; text-transform: uppercase;">STATUS: {status}</td>
                                    </tr>
                                </table>

                                <!-- Mismatch Audit Table -->
                                <h3 style="color: #374151; font-size: 13px; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;">Diagnostic Issues Log</h3>
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-collapse: collapse; font-size: 12px; text-align: left; margin-bottom: 20px;">
                                    <thead>
                                        <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                                            <th style="padding: 10px; font-weight: bold; color: #374151;">PARAMETER</th>
                                            <th style="padding: 10px; font-weight: bold; color: #374151;">SEVERITY</th>
                                            <th style="padding: 10px; font-weight: bold; color: #374151;">MESSAGE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issues_html}
                                    </tbody>
                                </table>

                                <!-- Quick Actions Link -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td align="center" style="padding: 10px 0 20px 0;">
                                            <a href="http://localhost:3000/dashboard/diagnostics" style="background-color: #FFCC00; color: #000000; text-decoration: none; padding: 12px 30px; font-weight: bold; border-radius: 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Open Diagnostic Bench</a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="color: #9ca3af; font-size: 11px; margin-top: 15px; border-top: 1px solid #f3f4f6; padding-top: 15px;">
                                    Report Generated: {timestamp_str}<br>
                                    Recipient list: {", ".join(recipient_emails)}
                                </p>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr style="background-color: #f9fafb; color: #6b7280; font-size: 11px; border-top: 1px solid #e5e7eb;">
                            <td style="padding: 20px 30px; text-align: center; line-height: 1.5;">
                                This is an automated notification from the Caterpillar Industrial diagnostics portal. 
                                Do not reply directly to this email.<br>
                                <strong>CONFIDENTIAL - INTERNAL MAINTENANCE ACCESS ONLY</strong>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    # 4. Save to last_alert_email.html for development verification/testing
    os.makedirs("backend/static/reports", exist_ok=True)
    local_log_path = "backend/static/reports/last_alert_email.html"
    try:
        with open(local_log_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Logged last alert HTML email successfully to: {local_log_path}")
    except Exception as e:
        print(f"Error logging HTML mail to static file: {e}")

    # 5. Dispatch email via SMTP
    if not recipient_emails:
        print("Skipping SMTP send: No recipient email addresses defined.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"CRITICAL RISK ALERT: {machine_id} Health score {health_score}%"
    msg["From"] = smtp_from
    msg["To"] = ", ".join(recipient_emails)
    msg.attach(MIMEText(html_content, "html"))

    try:
        # Connect to SMTP server
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=5)
        # Authenticate if credentials are provided
        if smtp_user and smtp_password:
            server.starttls()
            server.login(smtp_user, smtp_password)
        
        server.sendmail(smtp_from, recipient_emails, msg.as_string())
        server.quit()
        print(f"Alert email successfully sent to {recipient_emails} via SMTP.")
        return True
    except Exception as e:
        print(f"SMTP transmission skipped/failed: {e} (HTML email logged to: {local_log_path})")
        return False
