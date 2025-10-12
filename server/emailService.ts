// server/emailService.ts
import sgMail from "@sendgrid/mail";
import { renderTemplate } from "./email/templateRenderer";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  fromEmailOverride?: string;
  fromNameOverride?: string;
  bcc?: string | string[];
}

export interface EmailResult {
  success: boolean;
  statusCode?: number;
  messageId?: string;
  error?: string;
}

// Driver: "sendgrid" (default) or "smtp" to use simpleEmailService
const EMAIL_DRIVER = (process.env.EMAIL_DRIVER || "sendgrid").toLowerCase();

const SG_KEY = process.env.SENDGRID_API_KEY || "";
const SG_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "";
const SG_FROM_NAME = process.env.SENDGRID_FROM_NAME || "Ambersand";

if (EMAIL_DRIVER === "sendgrid" && SG_KEY) {
  sgMail.setApiKey(SG_KEY);
}

function normTo(to: string | string[]) {
  const arr = Array.isArray(to) ? to : [to];
  return arr.map(s => s.trim()).filter(Boolean);
}

async function sendWithSendgrid(opts: EmailOptions): Promise<EmailResult> {
  if (!SG_KEY) {
    console.error("❌ SendGrid: SENDGRID_API_KEY environment variable is not set");
    return { success: false, error: "SENDGRID_API_KEY missing" };
  }
  const toList = normTo(opts.to);
  if (!toList.length) {
    console.error("❌ SendGrid: No recipients provided");
    return { success: false, error: "No recipients" };
  }

  const fromEmail = (opts.fromEmailOverride || SG_FROM_EMAIL).trim();
  const fromName = (opts.fromNameOverride || SG_FROM_NAME).trim();
  if (!fromEmail) {
    console.error("❌ SendGrid: SENDGRID_FROM_EMAIL environment variable is not set");
    return { success: false, error: "SENDGRID_FROM_EMAIL missing (must be verified)" };
  }

  try {
    const msg: any = {
      from: { email: fromEmail, name: fromName },
      to: toList, // array supported by @sendgrid/mail
    };

    // Add BCC if provided
    if (opts.bcc) {
      const bccList = normTo(opts.bcc);
      if (bccList.length) {
        msg.bcc = bccList;
      }
    }

    if (opts.templateId) {
      msg.templateId = opts.templateId;
      msg.dynamicTemplateData = opts.dynamicTemplateData || {};
      if (opts.subject) msg.subject = opts.subject; // optional; template may set it
    } else {
      msg.subject = opts.subject || "(no subject)";
      if (opts.html) msg.html = opts.html;
      // Always provide text
      msg.text = opts.text || (opts.html ? opts.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "(empty email)");
    }

    const resp = await sgMail.send(msg); // IMPORTANT: await
    const statusCode = resp?.[0]?.statusCode;
    const messageId = resp?.[0]?.headers?.["x-message-id"] || resp?.[0]?.headers?.["x-message-id".toLowerCase()];
    if (statusCode && statusCode >= 200 && statusCode < 300) {
      console.log(`✅ SendGrid: Email sent successfully to ${toList.join(', ')} | Subject: "${msg.subject}" | Status: ${statusCode}`);
      return { success: true, statusCode, messageId };
    }
    console.error(`❌ SendGrid: Non-2xx status code: ${statusCode}`);
    return { success: false, statusCode, error: `SendGrid non-2xx: ${statusCode}` };
  } catch (err: any) {
    const sgErr = err?.response?.body || err?.message || String(err);
    console.error("❌ SendGrid error:", sgErr);
    return { success: false, error: typeof sgErr === "string" ? sgErr : JSON.stringify(sgErr) };
  }
}

async function sendWithSmtp(opts: EmailOptions): Promise<EmailResult> {
  // Defer to the simple (working) service
  const mod = await import("./simpleEmailService");
  const simple = (mod.default || (mod as any).emailService);
  if (!simple?.sendEmail) return { success: false, error: "simpleEmailService missing sendEmail" };
  return simple.sendEmail({
    to: Array.isArray(opts.to) ? opts.to[0] : opts.to,
    subject: opts.subject || 'No Subject',
    html: opts.html || '',
    text: opts.text,
    bcc: opts.bcc,
    // templateId/dynamicTemplateData are ignored by SMTP; if you need templates with SMTP,
    // render them before calling or add a facade (we can do this later).
    fromEmailOverride: opts.fromEmailOverride,
    fromNameOverride: opts.fromNameOverride,
  });
}

export const emailService = {
  getBaseUrl(): string {
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
    // Fix missing protocol for Replit apps
    if (baseUrl.startsWith("//")) {
      return `https:${baseUrl}`;
    }
    return baseUrl;
  },

  async sendTaskAssignmentEmail(toEmail: string, userName: string, taskTitle: string, dueDate: string, projectName: string, language: 'en'|'ar'='en', taskId?: number): Promise<EmailResult> {
    const baseUrl = this.getBaseUrl();
    const taskLink = taskId ? `${baseUrl}/tasks/${taskId}` : `${baseUrl}/my-tasks`;
    const tpl = language === 'ar' ? "task-assigned.ar" : "task-assigned.en";
    const html = await renderTemplate(tpl, { userName, taskTitle, projectName, dueDate, taskLink });
    const subject = language === 'ar' ? `مهمة جديدة: ${taskTitle}` : `New Task Assignment: ${taskTitle}`;
    return this.sendEmailWithRetry({ to: toEmail, subject, html });
  },

  async sendDeadlineReminderEmail(toEmail: string, userName: string, taskTitle: string, dueDate: string, language:'en'|'ar'='en', taskId?: number): Promise<EmailResult> {
    const baseUrl = this.getBaseUrl();
    const taskLink = taskId ? `${baseUrl}/tasks/${taskId}` : `${baseUrl}/my-tasks`;
    const tpl = language === 'ar' ? "deadline-reminder.ar" : "deadline-reminder.en";
    const html = await renderTemplate(tpl, { userName, taskTitle, dueDate, taskLink });
    const subject = language === 'ar' ? `تذكير: موعد تسليم المهمة "${taskTitle}" يقترب` : `Reminder: Task "${taskTitle}" Due Soon`;
    return this.sendEmailWithRetry({ to: toEmail, subject, html });
  },

  async sendStatusUpdateEmail(toEmail: string, userName: string, taskTitle: string, oldStatus:string, newStatus:string, language:'en'|'ar'='en', taskId?: number): Promise<EmailResult> {
    const baseUrl = this.getBaseUrl();
    const taskLink = taskId ? `${baseUrl}/tasks/${taskId}` : `${baseUrl}/my-tasks`;
    const tpl = language === 'ar' ? "status-update.ar" : "status-update.en";
    const html = await renderTemplate(tpl, { userName, taskTitle, oldStatus, newStatus, taskLink });
    const subject = language === 'ar' ? `تحديث حالة المهمة: ${taskTitle}` : `Task Status Update: ${taskTitle}`;
    return this.sendEmailWithRetry({ to: toEmail, subject, html });
  },

  async sendInvitationEmail(toEmail: string, inviterName: string, organizationName: string, personalMessage = '', inviteUrl: string): Promise<EmailResult> {
    const html = await renderTemplate("user-invitation.en", { inviterName, organizationName, personalMessage, inviteUrl });
    const subject = `You've been invited to join ${organizationName}`;
    return this.sendEmailWithRetry({ to: toEmail, subject, html });
  },

  async sendPasswordResetEmail(toEmail: string, userName: string, resetUrl: string, language:'en'|'ar'='en'): Promise<EmailResult> {
    const tpl = language === 'ar' ? "password-reset.ar" : "password-reset.en";
    const html = await renderTemplate(tpl, { userName, resetUrl });
    const subject = language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Password Reset Request';
    return this.sendEmailWithRetry({ to: toEmail, subject, html });
  },

  async sendVerificationEmail(toEmail: string, userName: string, verificationUrl: string): Promise<EmailResult> {
    const html = await renderTemplate("email-verification.en", { userName, verificationUrl });
    const subject = 'Verify Your Email Address - Ambersand';
    return this.sendEmailWithRetry({ to: toEmail, subject, html });
  },

  async sendEmail(opts: EmailOptions): Promise<EmailResult> {
    if ((process.env.EMAIL_DRIVER || "sendgrid").toLowerCase() === "smtp") {
      return sendWithSmtp(opts);
    }
    return sendWithSendgrid(opts);
  },

  async sendEmailWithRetry(opts: EmailOptions, maxRetries = 3): Promise<EmailResult> {
    let last: EmailResult = { success: false, error: "not attempted" };
    for (let i = 1; i <= maxRetries; i++) {
      const res = await this.sendEmail(opts);
      if (res.success) return res;
      last = res;
      await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, i - 1), 8000)));
    }
    return { success: false, error: `Failed after ${maxRetries} retries: ${last.error}` };
  },
};

export default emailService;