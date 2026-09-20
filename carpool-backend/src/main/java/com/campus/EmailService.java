package com.campus;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import javax.mail.Authenticator;
import javax.mail.Message;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

public class EmailService {

    private static final String SMTP_HOST = "smtp.gmail.com";
    private static final String SMTP_PORT = "587";
    private static final String SENDER_EMAIL = "testprointjec@gmail.com";
    private static final String SENDER_PASSWORD = "kcrm kyoq samu ckrq";

    private static Session createSession() {
        Properties props = new Properties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.host", SMTP_HOST);
        props.put("mail.smtp.port", SMTP_PORT);
        props.put("mail.smtp.ssl.protocols", "TLSv1.2");

        return Session.getInstance(props, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(SENDER_EMAIL, SENDER_PASSWORD);
            }
        });
    }

    /**
     * Sends a formatted HTML OTP verification email to the user.
     */
    public static void sendOtpEmail(String recipient, String otp) {
        new Thread(() -> {
            try {
                if ("YOUR_EMAIL_HERE".equals(SENDER_EMAIL)) {
                    System.out.println("⚠️ [EmailService] SMTP credentials not configured yet. Simulated OTP sent to "
                            + recipient + ": " + otp);
                    return;
                }

                Session session = createSession();
                Message message = new MimeMessage(session);
                message.setFrom(new InternetAddress(SENDER_EMAIL, "Campus Carpool"));
                message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(recipient));
                message.setSubject("Your Campus Carpool Verification Code");

                String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;'>"
                        + "<h2 style='color: #0d9488; text-align: center;'>Campus Carpool Verification</h2>"
                        + "<p>Hello,</p>"
                        + "<p>Thank you for registering with Campus Carpool. Please use the following 6-digit One-Time Password (OTP) to verify your institutional account:</p>"
                        + "<div style='text-align: center; margin: 30px 0;'>"
                        + "<span style='font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0d9488; background-color: #f0fdfa; padding: 12px 24px; border-radius: 8px; border: 1px dashed #0d9488; display: inline-block;'>"
                        + otp + "</span>"
                        + "</div>"
                        + "<p style='color: #64748b; font-size: 14px;'>This OTP will expire in 10 minutes. If you did not request this verification, please disregard this message.</p>"
                        + "<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'/>"
                        + "<p style='color: #94a3b8; font-size: 12px; text-align: center;'>Campus Carpool &copy; 2026 Jyothi Engineering College</p>"
                        + "</div>";

                message.setContent(htmlContent, "text/html; charset=utf-8");
                Transport.send(message);
                System.out.println("✅ [EmailService] OTP email successfully dispatched to: " + recipient);
            } catch (Exception e) {
                System.err.println("❌ [EmailService] Error sending OTP email to " + recipient + ": " + e.getMessage());
            }
        }).start();
    }

    /**
     * Sends a comprehensive SOS emergency alert email to administration.
     */
    @SuppressWarnings("unchecked")
    public static void sendSosEmail(String adminEmail, Map<String, Object> rideDetails, double lat, double lng) {
        new Thread(() -> {
            try {
                if ("YOUR_EMAIL_HERE".equals(SENDER_EMAIL)) {
                    System.out.println(
                            "⚠️ [EmailService] SMTP credentials not configured yet. Simulated SOS alert dispatched to: "
                                    + adminEmail);
                    return;
                }

                Session session = createSession();
                Message message = new MimeMessage(session);
                message.setFrom(new InternetAddress(SENDER_EMAIL, "Campus Carpool Security Core"));
                message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(adminEmail));
                message.setSubject("🚨 CRITICAL: SOS Emergency Alert Triggered on Campus Carpool");

                String incidentTime = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss z").format(new Date());

                Map<String, Object> driver = (Map<String, Object>) rideDetails.getOrDefault("driver", Map.of());
                Map<String, Object> vehicle = (Map<String, Object>) rideDetails.getOrDefault("vehicle", Map.of());
                List<Map<String, Object>> passengers = (List<Map<String, Object>>) rideDetails
                        .getOrDefault("passengers", List.of());

                StringBuilder passengerRows = new StringBuilder();
                if (passengers.isEmpty()) {
                    passengerRows.append(
                            "<tr><td colspan='3' style='padding: 8px; text-align: center; color: #64748b;'>No accepted passengers on this ride.</td></tr>");
                } else {
                    for (Map<String, Object> p : passengers) {
                        passengerRows.append("<tr>")
                                .append("<td style='padding: 8px; border-bottom: 1px solid #cbd5e1;'>")
                                .append(p.getOrDefault("name", "N/A")).append("</td>")
                                .append("<td style='padding: 8px; border-bottom: 1px solid #cbd5e1;'>")
                                .append(p.getOrDefault("phone", "N/A")).append("</td>")
                                .append("<td style='padding: 8px; border-bottom: 1px solid #cbd5e1;'>")
                                .append(p.getOrDefault("email", "N/A")).append("</td>")
                                .append("</tr>");
                    }
                }

                String mapLink = String.format("https://www.google.com/maps?q=%f,%f", lat, lng);

                String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 650px; margin: auto; padding: 25px; border: 2px solid #e11d48; border-radius: 12px; background-color: #fff1f2;'>"
                        + "<h1 style='color: #e11d48; text-align: center; margin-top: 0;'>🚨 SOS EMERGENCY ALERT</h1>"
                        + "<p style='font-size: 16px; color: #1e293b; text-align: center;'>An emergency alert was triggered by a user during an active campus journey.</p>"
                        + "<div style='background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #fda4af;'>"
                        + "<p><strong>Incident Timestamp:</strong> " + incidentTime + "</p>"
                        + "<p><strong>Exact Coordinates:</strong> " + lat + ", " + lng + "</p>"
                        + "<p style='margin: 15px 0;'><a href='" + mapLink
                        + "' style='background-color: #e11d48; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;' target='_blank'>View Exact Location on Google Maps</a></p>"
                        + "</div>"
                        + "<h3 style='color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;'>Driver Details</h3>"
                        + "<ul style='color: #334155; line-height: 1.8;'>"
                        + "<li><strong>Name:</strong> " + driver.getOrDefault("name", "N/A") + "</li>"
                        + "<li><strong>Phone:</strong> " + driver.getOrDefault("phone", "N/A") + "</li>"
                        + "<li><strong>Email:</strong> " + driver.getOrDefault("email", "N/A") + "</li>"
                        + "</ul>"
                        + "<h3 style='color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;'>Vehicle Information</h3>"
                        + "<ul style='color: #334155; line-height: 1.8;'>"
                        + "<li><strong>Vehicle:</strong> " + vehicle.getOrDefault("make", "") + " "
                        + vehicle.getOrDefault("model", "N/A") + "</li>"
                        + "<li><strong>License Plate:</strong> <span style='font-weight: bold; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;'>"
                        + vehicle.getOrDefault("license_plate", "N/A") + "</span></li>"
                        + "<li><strong>Color:</strong> " + vehicle.getOrDefault("color", "N/A") + "</li>"
                        + "</ul>"
                        + "<h3 style='color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;'>Passenger Manifest (Accepted)</h3>"
                        + "<table style='width: 100%; border-collapse: collapse; text-align: left; background: white; border-radius: 6px; overflow: hidden;'>"
                        + "<thead><tr style='background: #fee2e2; color: #991b1b;'>"
                        + "<th style='padding: 8px;'>Passenger Name</th><th style='padding: 8px;'>Phone</th><th style='padding: 8px;'>Email</th>"
                        + "</tr></thead>"
                        + "<tbody>" + passengerRows.toString() + "</tbody>"
                        + "</table>"
                        + "<p style='color: #64748b; font-size: 13px; margin-top: 25px; text-align: center;'>This is an automated emergency notification dispatched by Campus Carpool Security Core.</p>"
                        + "</div>";

                message.setContent(htmlContent, "text/html; charset=utf-8");
                Transport.send(message);
                System.out.println("🚨 [EmailService] Emergency SOS alert dispatched via email to: " + adminEmail);
            } catch (Exception e) {
                System.err.println("❌ [EmailService] Error sending SOS email alert: " + e.getMessage());
            }
        }).start();
    }
}
