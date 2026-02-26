// ProConnect — Notification Helper
// Shared utility to create notifications and send notification emails

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/client";

interface SmtpSettings {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

interface CreateNotificationInput {
  /** The DB User.id of the recipient */
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Optional JSON metadata (link URL, sender name, etc.) */
  metadata?: Record<string, string>;
}

async function getSmtpSettings(): Promise<SmtpSettings | null> {
  try {
    const setting = await prisma.calendarSetting.findUnique({ where: { id: "smtp_settings" } });
    if (!setting) return null;
    const parsed = JSON.parse(setting.data) as SmtpSettings;
    if (!parsed.host || !parsed.user || !parsed.pass) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getCompanyName(): Promise<string> {
  try {
    const branding = await prisma.siteBranding.findUnique({ where: { id: "singleton" } });
    return branding?.companyName || "ProConnect";
  } catch {
    return "ProConnect";
  }
}

function buildEmailHtml(title: string, message: string, companyName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#06427F,#0d5ba8);padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">${companyName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:18px;">${title}</h2>
            <p style="margin:0 0 24px;color:#4a4a4a;font-size:15px;line-height:1.6;">${message}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              This is an automated notification from ${companyName}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Create an in-app notification and optionally send an email.
 * Returns the created notification record.
 */
export async function createNotification(input: CreateNotificationInput) {
  const { recipientUserId, type, title, message, metadata } = input;

  // 1. Create in-app notification
  const notification = await prisma.notification.create({
    data: {
      userId: recipientUserId,
      type,
      title,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  // 2. Try to send email notification
  try {
    const smtp = await getSmtpSettings();
    if (!smtp) return notification; // no SMTP configured, skip email

    // Get recipient email
    const recipient = await prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { email: true, displayName: true },
    });
    if (!recipient?.email) return notification;

    const companyName = await getCompanyName();
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: smtp.host,
      port: parseInt(smtp.port || "587", 10),
      secure: smtp.port === "465",
      auth: { user: smtp.user, pass: smtp.pass },
    });

    await transporter.sendMail({
      from: `"${smtp.fromName || companyName}" <${smtp.from || smtp.user}>`,
      to: recipient.email,
      subject: title,
      html: buildEmailHtml(title, message, companyName),
    });
  } catch (err) {
    // Email failure should not block the notification creation
    console.error("[Notification] Email send failed:", err);
  }

  return notification;
}

/**
 * Find or create a User record by logtoId, email and name.
 * Returns the DB user id.
 */
export { ensureDbUser } from "@/lib/prisma";
