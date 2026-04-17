// ProConnect — Notification Helper
// Shared utility to create notifications and send notification emails

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/client";
import nodemailer from "nodemailer";

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

function getEnvSmtpSettings(): SmtpSettings | null {
  const sendgridApiKey = process.env.SENDGRID_API_KEY?.trim() || "";
  const host = process.env.SMTP_HOST?.trim() || (sendgridApiKey ? "smtp.sendgrid.net" : "");
  const port = process.env.SMTP_PORT?.trim() || "587";
  const user = process.env.SMTP_USER?.trim() || (sendgridApiKey ? "apikey" : "");
  const pass = process.env.SMTP_PASS?.trim() || sendgridApiKey;
  const from = process.env.SMTP_FROM?.trim() || "";
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "ProConnect";

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port, user, pass, from, fromName };
}

async function getCompanyName(): Promise<string> {
  try {
    const branding = await prisma.siteBranding.findUnique({ where: { id: "singleton" } });
    return branding?.companyName || "ProConnect";
  } catch {
    return "ProConnect";
  }
}

function buildEmailHtml(title: string, message: string, companyName: string, hasLogo: boolean): string {
  const logoHtml = hasLogo
    ? '<img src="cid:companylogo" alt="" style="max-height:60px;width:auto;display:block;">'
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td bgcolor="#06427F" style="background-color:#06427F;background:linear-gradient(135deg,#06427F,#0d5ba8);padding:24px 32px;">
            ${hasLogo ? logoHtml : `<h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">${companyName}</h1>`}
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:18px;">${title}</h2>
            <p style="margin:0 0 24px;color:#4a4a4a;font-size:15px;line-height:1.6;">${message}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
              This is an automated notification from ${companyName}.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="https://proconnect.mtgpros.com" style="color:#0d5ba8;font-size:12px;text-decoration:none;">proconnect.mtgpros.com</a>
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
    console.log(`[Notification] Attempting email for type=${type} to recipientUserId=${recipientUserId} title="${title}"`);

    const smtp = getEnvSmtpSettings();
    if (!smtp) {
      console.warn("[Notification] No SMTP env vars configured (SENDGRID_API_KEY or SMTP_HOST/USER/PASS) — skipping email");
      return notification;
    }
    console.log(`[Notification] SMTP configured: host=${smtp.host} port=${smtp.port} from=${smtp.from || smtp.user}`);

    // Get recipient email
    const recipient = await prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { email: true, displayName: true },
    });
    if (!recipient?.email) {
      console.warn(`[Notification] Recipient userId=${recipientUserId} has no email address — skipping email. Display name: ${recipient?.displayName || "(none)"}`);
      return notification;
    }

    console.log(`[Notification] Sending email to ${recipient.email} (${recipient.displayName || "no display name"}) for type=${type}`);

    const companyName = await getCompanyName();

    // Fetch site logo for email header
    let logoAttachment: { filename: string; content: Buffer; cid: string; contentType: string } | null = null;
    try {
      const branding = await prisma.siteBranding.findUnique({ where: { id: "singleton" }, select: { logoData: true, darkLogoData: true } });
      // Prefer dark logo (likely white/light, shows well on dark blue header), fall back to main logo
      const logoData = branding?.darkLogoData || branding?.logoData || null;
      if (logoData?.startsWith("data:image")) {
        const matches = logoData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          logoAttachment = {
            filename: `logo.${matches[1]}`,
            content: Buffer.from(matches[2], "base64"),
            cid: "companylogo",
            contentType: `image/${matches[1]}`,
          };
        }
      }
    } catch { /* no logo — that's fine */ }

    const mailOptions: {
      from: string;
      to: string;
      subject: string;
      html: string;
      attachments?: { filename: string; content: Buffer; cid: string; contentType: string }[];
    } = {
      from: `"${smtp.fromName || companyName}" <${smtp.from || smtp.user}>`,
      to: recipient.email,
      subject: title,
      html: buildEmailHtml(title, message, companyName, !!logoAttachment),
    };

    if (logoAttachment) {
      mailOptions.attachments = [logoAttachment];
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: parseInt(smtp.port || "587", 10),
      secure: smtp.port === "465",
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Notification] Email SENT successfully to=${recipient.email} type=${type} messageId=${info.messageId} response="${info.response}"`);
  } catch (err) {
    // Email failure should not block the notification creation
    const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error(`[Notification] Email FAILED for type=${type} recipientUserId=${recipientUserId}: ${errMsg}`);
  }

  return notification;
}

/**
 * Find or create a User record by logtoId, email and name.
 * Returns the DB user id.
 */
export { ensureDbUser } from "@/lib/prisma";
