// ProConnect — Calendar Export/Email API Route
// Sends calendar emails via SMTP (nodemailer) and test emails

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Nodemailer is dynamically imported to avoid build issues if not installed
async function getNodemailer() {
  try {
    return await import("nodemailer");
  } catch {
    return null;
  }
}

interface SmtpSettings {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

interface EmailTemplate {
  subject: string;
  headerText: string;
  footerText: string;
  includeCompanyLogo: boolean;
  layout: "list" | "calendar";
}

interface HolidayItem {
  title: string;
  date: string;
  category: string;
  color: string;
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

async function getCategoryLabels(): Promise<{ federal: string; fun: string; company: string }> {
  try {
    const setting = await prisma.calendarSetting.findUnique({ where: { id: "category_labels" } });
    if (!setting) return { federal: "Federal", fun: "Fun", company: "Company" };
    return { federal: "Federal", fun: "Fun", company: "Company", ...JSON.parse(setting.data) };
  } catch {
    return { federal: "Federal", fun: "Fun", company: "Company" };
  }
}

async function getBrandingLogo(): Promise<string | null> {
  try {
    const branding = await prisma.siteBranding.findUnique({ where: { id: "singleton" } });
    return branding?.logoData || null;
  } catch {
    return null;
  }
}

async function getCategoryColors(): Promise<{ federal: string; fun: string; company: string }> {
  try {
    const setting = await prisma.calendarSetting.findUnique({ where: { id: "category_colors" } });
    if (!setting) return { federal: "#1e40af", fun: "#16a34a", company: "#06427F" };
    return { federal: "#1e40af", fun: "#16a34a", company: "#06427F", ...JSON.parse(setting.data) };
  } catch {
    return { federal: "#1e40af", fun: "#16a34a", company: "#06427F" };
  }
}

function generateListHtml(
  holidays: HolidayItem[],
  monthName: string,
  year: number,
  categoryLabels: { federal: string; fun: string; company: string }
): string {
  if (holidays.length === 0) {
    return `<p style="text-align:center;color:#666;padding:40px 0;">No holidays for ${monthName} ${year}</p>`;
  }

  const rows = holidays
    .map((h) => {
      const d = new Date(h.date + "T00:00:00");
      const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
      const dayNum = d.getDate();
      const label = categoryLabels[h.category as keyof typeof categoryLabels] || h.category;
      return `<tr>
        <td style="padding:12px;border-bottom:1px solid #e5e5e5;">
          <span style="display:inline-block;width:12px;height:12px;background:${h.color};border-radius:50%;margin-right:8px;"></span>${h.title}
        </td>
        <td style="padding:12px;border-bottom:1px solid #e5e5e5;color:#666;">${dayName}, ${monthName} ${dayNum}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e5e5;">
          <span style="background:${h.color};color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">${label}</span>
        </td>
      </tr>`;
    })
    .join("");

  return `<table style="width:100%;border-collapse:collapse;">
    <thead><tr style="background:#f9fafb;">
      <th style="padding:12px;text-align:left;font-weight:600;color:#374151;width:50%;">Holiday</th>
      <th style="padding:12px;text-align:left;font-weight:600;color:#374151;width:30%;">Date</th>
      <th style="padding:12px;text-align:left;font-weight:600;color:#374151;width:20%;">Type</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function generateCalendarGridHtml(
  holidays: HolidayItem[],
  month: number,
  year: number,
  categoryLabels: { federal: string; fun: string; company: string }
): string {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const byDay: Record<number, HolidayItem[]> = {};
  holidays.forEach((h) => {
    const day = new Date(h.date + "T00:00:00").getDate();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(h);
  });

  const weeks: string[] = [];
  let currentDay = 1;

  while (currentDay <= daysInMonth) {
    const cells: string[] = [];
    for (let i = 0; i < 7; i++) {
      if ((weeks.length === 0 && i < startingDay) || currentDay > daysInMonth) {
        cells.push('<td style="padding:4px;border:1px solid #e5e5e5;vertical-align:top;background:#f9fafb;"></td>');
      } else {
        const dayH = byDay[currentDay] || [];
        const dots = dayH.map((h) => `<div style="font-size:9px;padding:2px 3px;margin:1px 0;background:${h.color};color:#fff;border-radius:2px;line-height:1.2;">${h.title}</div>`).join("");
        cells.push(`<td style="padding:4px;border:1px solid #e5e5e5;vertical-align:top;width:14.28%;">
          <div><div style="font-weight:bold;font-size:12px;margin-bottom:2px;">${currentDay}</div>${dots}</div>
        </td>`);
        currentDay++;
      }
    }
    weeks.push(`<tr>${cells.join("")}</tr>`);
  }

  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    <thead><tr style="background:#06427F;">
      ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => `<th style="padding:10px;color:#fff;text-align:center;font-weight:600;width:14.28%;">${d}</th>`).join("")}
    </tr></thead>
    <tbody>${weeks.join("")}</tbody>
  </table>
  <div style="margin-top:16px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
    <span style="display:inline-flex;align-items:center;font-size:12px;"><span style="width:12px;height:12px;background:CATCOLOR_FEDERAL;border-radius:50%;margin-right:6px;"></span>${categoryLabels.federal}</span>
    <span style="display:inline-flex;align-items:center;font-size:12px;"><span style="width:12px;height:12px;background:CATCOLOR_FUN;border-radius:50%;margin-right:6px;"></span>${categoryLabels.fun}</span>
    <span style="display:inline-flex;align-items:center;font-size:12px;"><span style="width:12px;height:12px;background:CATCOLOR_COMPANY;border-radius:50%;margin-right:6px;"></span>${categoryLabels.company}</span>
  </div>`;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // ── Test email ───────────────────────────────────────
    if (action === "test") {
      const { email } = body;
      if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

      const smtp = await getSmtpSettings();
      if (!smtp) return NextResponse.json({ error: "SMTP not configured" }, { status: 400 });

      const nodemailer = await getNodemailer();
      if (!nodemailer) return NextResponse.json({ error: "nodemailer not installed" }, { status: 500 });

      const transporter = nodemailer.default.createTransport({
        host: smtp.host,
        port: parseInt(smtp.port || "587", 10),
        secure: smtp.port === "465",
        auth: { user: smtp.user, pass: smtp.pass },
      });

      await transporter.sendMail({
        from: `"${smtp.fromName}" <${smtp.from || smtp.user}>`,
        to: email,
        subject: "ProConnect Calendar - Test Email",
        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <div style="background:#06427F;padding:20px;border-radius:8px;text-align:center;">
            <h1 style="color:#fff;margin:0;">Test Email</h1>
          </div>
          <div style="padding:20px;background:#f9f9f9;border-radius:0 0 8px 8px;">
            <p>This is a test email from ProConnect Calendar.</p>
            <p>If you received this, your SMTP settings are configured correctly!</p>
          </div>
        </div>`,
      });

      return NextResponse.json({ message: "Test email sent" });
    }

    // ── Send calendar email ──────────────────────────────
    if (action === "send") {
      const { recipients, month, year, template, holidays } = body as {
        recipients: string[];
        month: number;
        year: number;
        template: EmailTemplate;
        holidays: HolidayItem[];
      };

      if (!recipients?.length) return NextResponse.json({ error: "Recipients required" }, { status: 400 });

      const smtp = await getSmtpSettings();
      if (!smtp) return NextResponse.json({ error: "SMTP not configured" }, { status: 400 });

      const nodemailer = await getNodemailer();
      if (!nodemailer) return NextResponse.json({ error: "nodemailer not installed" }, { status: 500 });

      const transporter = nodemailer.default.createTransport({
        host: smtp.host,
        port: parseInt(smtp.port || "587", 10),
        secure: smtp.port === "465",
        auth: { user: smtp.user, pass: smtp.pass },
      });

      const categoryLabels = await getCategoryLabels();
      const catColors = await getCategoryColors();
      const monthName = MONTH_NAMES[month];

      let contentHtml =
        template.layout === "calendar"
          ? generateCalendarGridHtml(holidays, month, year, categoryLabels)
          : generateListHtml(holidays, monthName, year, categoryLabels);

      // Replace legend color placeholders with actual category colors
      contentHtml = contentHtml
        .replace(/CATCOLOR_FEDERAL/g, catColors.federal)
        .replace(/CATCOLOR_FUN/g, catColors.fun)
        .replace(/CATCOLOR_COMPANY/g, catColors.company);

      // Get logo for CID attachment
      const logoData = template.includeCompanyLogo ? await getBrandingLogo() : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let logoAttachment: any = null;
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

      const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#f5f5f4;">
  <div style="max-width:800px;margin:0 auto;padding:20px;">
    <div style="background:#06427F;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      ${logoAttachment ? '<img src="cid:companylogo" alt="Logo" style="max-height:60px;margin-bottom:12px;">' : '<h1 style="color:#fff;margin:0;font-size:24px;">ProConnect</h1>'}
      <h2 style="color:#fff;margin:12px 0 0;font-size:18px;font-weight:normal;">${template.headerText || `${monthName} ${year} Holiday Calendar`}</h2>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      ${contentHtml}
      ${template.footerText ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;color:#666;font-size:14px;">${template.footerText}</div>` : ""}
    </div>
    <div style="text-align:center;padding:16px;color:#999;font-size:12px;">Sent from ProConnect Calendar</div>
  </div>
</body></html>`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mailOptions: any = {
        from: `"${smtp.fromName}" <${smtp.from || smtp.user}>`,
        to: recipients.join(", "),
        subject: template.subject || `${monthName} ${year} Holiday Calendar`,
        html: emailHtml,
      };

      if (logoAttachment) {
        mailOptions.attachments = [logoAttachment];
      }

      await transporter.sendMail(mailOptions);

      return NextResponse.json({ message: `Email sent to ${recipients.length} recipient(s)`, sentTo: recipients.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Calendar Export] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${msg}` }, { status: 500 });
  }
}
