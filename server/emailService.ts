import { Resend } from "resend";

type Lang = "en" | "ar";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}

interface SendResult {
  id?: string;
  object?: string;
}

const resendApiKey = process.env.RESEND_API_KEY;
const FROM_NAME = process.env.FROM_NAME || "Ambersand";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@ambersand.com"; // MUST be a verified domain in Resend

// ---------- Helpers ----------
function getBaseUrl(): string {
  // Prefer explicit prod URL if set; fall back to Replit prod; then local
  const hinted = process.env.BASE_URL?.trim();
  if (hinted) return hinted;
  if (process.env.REPLIT_CLUSTER) return "https://ambersand-v1.replit.app";
  return "http://localhost:5000";
}

function getFromAddress(): string {
  return `${FROM_NAME} <${FROM_EMAIL}>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyError(e: unknown): { code?: string; message: string } {
  const msg =
    typeof e === "string" ? e : (e as any)?.message || JSON.stringify(e ?? {});
  const lower = msg.toLowerCase();

  if (lower.includes("sandbox") || lower.includes("unverified")) {
    return {
      code: "SANDBOX_OR_UNVERIFIED",
      message:
        "Resend sandbox or unverified recipient/sender. Verify your domain & recipients and/or leave sandbox.",
    };
  }
  if (
    lower.includes("dmarc") ||
    lower.includes("dkim") ||
    lower.includes("spf")
  ) {
    return {
      code: "AUTHENTICATION_DNS",
      message:
        "Sender domain authentication (SPF/DKIM/DMARC) failed. Ensure DNS records are set and domain is verified.",
    };
  }
  if (lower.includes("rate") || lower.includes("429")) {
    return { code: "RATE_LIMIT", message: "Email service rate-limited." };
  }
  if (lower.includes("5") && lower.includes("server")) {
    return { code: "SERVER_ERROR", message: "Email service server error." };
  }
  return { code: undefined, message: msg };
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------- Core Service ----------
const resend = new Resend(resendApiKey);

export const emailService = {
  // Generic sender with retry/backoff for transient errors
  async sendEmail({
    to,
    subject,
    html,
    text,
    headers,
  }: EmailOptions): Promise<SendResult> {
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const recipients = Array.isArray(to) ? to : [to];
    const payload = {
      from: getFromAddress(),
      to: recipients,
      subject,
      html,
      text: text || stripHtml(html),
      headers,
    };

    const maxAttempts = 4;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`📧 [sendEmail] attempt=${attempt}`, {
          to: recipients,
          subject,
          from: getFromAddress(),
        });

        const { data, error } = await resend.emails.send(payload as any);

        if (error) {
          const { code, message } = classifyError(error);
          console.error("❌ Resend error:", {
            attempt,
            code,
            message,
            raw: error,
          });
          // Retry only on transient
          if (code === "RATE_LIMIT" || code === "SERVER_ERROR") {
            const backoff = Math.min(2000 * attempt, 8000);
            await sleep(backoff);
            continue;
          }
          throw new Error(message);
        }

        console.log("✅ Email sent:", data);
        return data || {};
      } catch (e) {
        lastErr = e;
        const { code, message } = classifyError(e);
        console.error("🚨 sendEmail failure:", { attempt, code, message });

        if (code === "RATE_LIMIT" || code === "SERVER_ERROR") {
          const backoff = Math.min(2000 * attempt, 8000);
          await sleep(backoff);
          continue;
        }
        break; // non-retryable
      }
    }

    // Optional: Hook for fallback provider (e.g., SES/Mailgun)
    // console.warn('↩️ Falling back to secondary email provider...');
    // await fallbackProvider.send({ to, subject, html, text });

    throw lastErr || new Error("Unknown email send failure");
  },

  // ---------- Templates ----------
  templates: {
    taskAssignment(
      userName: string,
      taskTitle: string,
      dueDate: string,
      projectName: string,
      language: Lang = "en",
      taskId?: number,
    ) {
      const baseUrl = getBaseUrl();
      const taskLink = taskId
        ? `${baseUrl}/tasks/${taskId}`
        : `${baseUrl}/my-tasks`;
      if (language === "ar") {
        return {
          subject: `مهمة جديدة: ${taskTitle}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif;">
              <h2>مهمة جديدة مُسندة إليك</h2>
              <p>مرحباً ${userName}،</p>
              <ul>
                <li><strong>المهمة:</strong> ${taskTitle}</li>
                <li><strong>المشروع:</strong> ${projectName}</li>
                <li><strong>تاريخ الاستحقاق:</strong> ${dueDate}</li>
              </ul>
              <p>يرجى تسجيل الدخول لعرض التفاصيل.</p>
              <a href="${taskLink}" style="background:#2699A6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">عرض المهمة</a>
            </div>
          `,
        };
      }
      return {
        subject: `New Task Assignment: ${taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>New Task Assigned to You</h2>
            <p>Hi ${userName},</p>
            <ul>
              <li><strong>Task:</strong> ${taskTitle}</li>
              <li><strong>Project:</strong> ${projectName}</li>
              <li><strong>Due Date:</strong> ${dueDate}</li>
            </ul>
            <p>Please log in to view details.</p>
            <a href="${taskLink}" style="background:#2699A6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Task</a>
          </div>
        `,
      };
    },

    deadlineReminder(
      userName: string,
      taskTitle: string,
      dueDate: string,
      language: Lang = "en",
      taskId?: number,
    ) {
      const baseUrl = getBaseUrl();
      const taskLink = taskId
        ? `${baseUrl}/tasks/${taskId}`
        : `${baseUrl}/my-tasks`;
      if (language === "ar") {
        return {
          subject: `تذكير: موعد تسليم "${taskTitle}" يقترب`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif;">
              <h2>تذكير بموعد التسليم</h2>
              <p>مرحباً ${userName}،</p>
              <p>هذا تذكير بأن موعد تسليم المهمة التالية يقترب:</p>
              <p><strong>${taskTitle}</strong></p>
              <p>موعد التسليم: <strong>${dueDate}</strong></p>
              <a href="${taskLink}" style="background:#ea580c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">عرض المهمة</a>
            </div>
          `,
        };
      }
      return {
        subject: `Reminder: "${taskTitle}" Due Soon`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Task Deadline Reminder</h2>
            <p>Hi ${userName},</p>
            <p>This is a reminder that the following task is due soon:</p>
            <p><strong>${taskTitle}</strong></p>
            <p>Due Date: <strong>${dueDate}</strong></p>
            <a href="${taskLink}" style="background:#ea580c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Task</a>
          </div>
        `,
      };
    },

    statusUpdate(
      userName: string,
      taskTitle: string,
      oldStatus: string,
      newStatus: string,
      language: Lang = "en",
      taskId?: number,
    ) {
      const baseUrl = getBaseUrl();
      const taskLink = taskId
        ? `${baseUrl}/tasks/${taskId}`
        : `${baseUrl}/my-tasks`;
      if (language === "ar") {
        return {
          subject: `تحديث حالة المهمة: ${taskTitle}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif;">
              <h2>تحديث حالة المهمة</h2>
              <p>مرحباً ${userName}،</p>
              <p>تم تحديث حالة المهمة "${taskTitle}":</p>
              <p>من: <span style="color:#6b7280;">${oldStatus}</span></p>
              <p>إلى: <span style="color:#2699A6;font-weight:bold;">${newStatus}</span></p>
              <a href="${taskLink}" style="background:#2699A6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">عرض التفاصيل</a>
            </div>
          `,
        };
      }
      return {
        subject: `Task Status Update: ${taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Task Status Updated</h2>
            <p>Hi ${userName},</p>
            <p>The status of task "${taskTitle}" has been updated:</p>
            <p>From: <span style="color:#6b7280;">${oldStatus}</span></p>
            <p>To: <span style="color:#2699A6;font-weight:bold;">${newStatus}</span></p>
            <a href="${taskLink}" style="background:#2699A6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Details</a>
          </div>
        `,
      };
    },

    userInvitation(
      inviterName: string,
      organizationName: string,
      personalMessage: string,
      inviteUrl: string,
    ) {
      return {
        subject: `You've been invited to join ${organizationName}`,
        html: `
          <!doctype html>
          <html><body style="margin:0;padding:0;font-family:Arial,sans-serif;line-height:1.6;color:#333;background:#f4f4f4;">
            <div style="max-width:600px;margin:0 auto;background:#fff;">
              <div style="background:#2699A6;padding:24px;text-align:center;color:#fff;">
                <h1 style="margin:0;font-size:24px;">Ambersand</h1>
                <p style="margin:6px 0 0;">Compliance Management Platform</p>
              </div>
              <div style="padding:28px;">
                <h2 style="color:#2699A6;margin:0 0 16px;">You've been invited to join ${organizationName}</h2>
                <p>Hello,</p>
                <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Ambersand.</p>
                ${personalMessage ? `<blockquote style="margin:16px 0;padding:12px;border-left:4px solid #2699A6;background:#f8f9fa;">${personalMessage}</blockquote>` : ""}
                <p>Click the button below to accept your invitation and set up your account:</p>
                <p style="text-align:center;margin:24px 0;">
                  <a href="${inviteUrl}" style="background:#2699A6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a>
                </p>
                <p style="font-size:12px;color:#666;">If the button doesn't work, copy and paste this link:</p>
                <code style="display:block;word-break:break-all;background:#f8f9fa;border:1px solid #e5e7eb;padding:8px;border-radius:4px;">${inviteUrl}</code>
              </div>
              <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#999;">
                <p style="margin:0;">© ${new Date().getFullYear()} Ambersand. All rights reserved.</p>
                <p style="margin:4px 0 0;">This invitation expires in 7 days.</p>
              </div>
            </div>
          </body></html>
        `,
      };
    },
  },

  // ---------- Convenience wrappers ----------
  async sendTaskAssignmentEmail(
    to: string | string[],
    opts: {
      userName: string;
      taskTitle: string;
      dueDate: string;
      projectName: string;
      language?: Lang;
      taskId?: number;
    },
  ) {
    const t = this.templates.taskAssignment(
      opts.userName,
      opts.taskTitle,
      opts.dueDate,
      opts.projectName,
      opts.language ?? "en",
      opts.taskId,
    );
    return this.sendEmail({ to, subject: t.subject, html: t.html });
  },

  async sendDeadlineReminderEmail(
    to: string | string[],
    opts: {
      userName: string;
      taskTitle: string;
      dueDate: string;
      language?: Lang;
      taskId?: number;
    },
  ) {
    const t = this.templates.deadlineReminder(
      opts.userName,
      opts.taskTitle,
      opts.dueDate,
      opts.language ?? "en",
      opts.taskId,
    );
    return this.sendEmail({ to, subject: t.subject, html: t.html });
  },

  async sendStatusUpdateEmail(
    to: string | string[],
    opts: {
      userName: string;
      taskTitle: string;
      oldStatus: string;
      newStatus: string;
      language?: Lang;
      taskId?: number;
    },
  ) {
    const t = this.templates.statusUpdate(
      opts.userName,
      opts.taskTitle,
      opts.oldStatus,
      opts.newStatus,
      opts.language ?? "en",
      opts.taskId,
    );
    return this.sendEmail({ to, subject: t.subject, html: t.html });
  },

  async sendInvitationEmail(
    toEmail: string,
    opts: {
      inviterName: string;
      organizationName: string;
      personalMessage?: string;
      inviteUrl: string;
    },
  ) {
    const t = this.templates.userInvitation(
      opts.inviterName,
      opts.organizationName,
      opts.personalMessage || "",
      opts.inviteUrl,
    );
    return this.sendEmail({ to: toEmail, subject: t.subject, html: t.html });
  },
};
