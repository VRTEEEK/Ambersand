// server/email/index.ts
import path from "path";
import fs from "fs/promises";
import Handlebars from "handlebars";

export type EmailTo = string | string[];

export interface EmailSendInput {
  to: EmailTo;
  subject?: string;
  html?: string;
  text?: string;

  // New, optional template API:
  templateId?: string;                    // SendGrid dynamic template id
  templateName?: string;                  // local hbs name (e.g., "task-assigned")
  data?: Record<string, any>;             // vars for the template

  fromEmailOverride?: string;
  fromNameOverride?: string;
}

export interface EmailResult {
  success: boolean;
  statusCode?: number;
  messageId?: string;
  error?: string;
}

const DRIVER = (process.env.EMAIL_DRIVER || "sendgrid").toLowerCase(); // "sendgrid" | "smtp"

// ---------- Local Handlebars renderer (used when DRIVER=smtp or when templateName provided) ----------
const TPL_DIR = path.join(process.cwd(), "server", "email", "templates"); // server/email/templates/*.hbs
const hbsCache: Record<string, Handlebars.TemplateDelegate> = {};

async function renderLocalTemplate(templateName: string, data: Record<string, any> = {}) {
  const key = templateName.replace(/\.hbs$/, "");
  if (!hbsCache[key]) {
    const file = path.join(TPL_DIR, `${key}.hbs`);
    const src = await fs.readFile(file, "utf8");
    hbsCache[key] = Handlebars.compile(src);
  }
  return hbsCache[key](data);
}

// ---------- Driver loaders ----------
async function sendWithSendgrid(input: EmailSendInput): Promise<EmailResult> {
  const mod = await import("../emailService"); // your SendGrid service
  const svc = (mod.default || mod.emailService) as {
    sendEmail: (o: any) => Promise<EmailResult>;
    sendEmailWithRetry: (o: any, n?: number) => Promise<EmailResult>;
  };
  if (!svc?.sendEmail) return { success: false, error: "SendGrid service missing sendEmail" };

  // If templateId is provided -> use dynamic template (SendGrid)
  if (input.templateId) {
    return svc.sendEmail({
      to: input.to,
      subject: input.subject, // optional; SG template can set it
      templateId: input.templateId,
      dynamicTemplateData: input.data || {},
      fromEmailOverride: input.fromEmailOverride,
      fromNameOverride: input.fromNameOverride,
    });
  }

  // If templateName is provided -> render locally and send as html/text
  if (input.templateName) {
    const html = await renderLocalTemplate(input.templateName, input.data || {});
    return svc.sendEmail({
      to: input.to,
      subject: input.subject || "[Ambersand]",
      html,
      text: input.text || html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      fromEmailOverride: input.fromEmailOverride,
      fromNameOverride: input.fromNameOverride,
    });
  }

  // Plain legacy path
  return svc.sendEmail({
    to: input.to,
    subject: input.subject || "[Ambersand]",
    html: input.html,
    text: input.text,
    fromEmailOverride: input.fromEmailOverride,
    fromNameOverride: input.fromNameOverride,
  });
}

async function sendWithSmtp(input: EmailSendInput): Promise<EmailResult> {
  const mod = await import("../simpleEmailService"); // your working simple service (SMTP/Nodemailer)
  const svc = (mod.default || mod.simpleEmailService) as {
    sendEmail: (o: any) => Promise<EmailResult>;
  };
  if (!svc?.sendEmail) return { success: false, error: "SimpleEmailService missing sendEmail" };

  // SMTP doesn't know SendGrid templateId → render locally if templateName provided
  if (input.templateName) {
    const html = await renderLocalTemplate(input.templateName, input.data || {});
    return svc.sendEmail({
      to: input.to,
      subject: input.subject || "[Ambersand]",
      html,
      text: input.text || html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      fromEmailOverride: input.fromEmailOverride,
      fromNameOverride: input.fromNameOverride,
    });
  }

  // If caller passed templateId only, allow fallback: render a minimal notice
  if (input.templateId && !input.templateName) {
    const html = `<p>Template not supported on SMTP. Data:</p><pre>${JSON.stringify(input.data || {}, null, 2)}</pre>`;
    return svc.sendEmail({
      to: input.to,
      subject: input.subject || "[Ambersand]",
      html,
      text: input.text || JSON.stringify(input.data || {}),
      fromEmailOverride: input.fromEmailOverride,
      fromNameOverride: input.fromNameOverride,
    });
  }

  // Plain legacy path
  return svc.sendEmail({
    to: input.to,
    subject: input.subject || "[Ambersand]",
    html: input.html,
    text: input.text,
    fromEmailOverride: input.fromEmailOverride,
    fromNameOverride: input.fromNameOverride,
  });
}

export const email = {
  async send(input: EmailSendInput): Promise<EmailResult> {
    if (DRIVER === "smtp") return sendWithSmtp(input);
    return sendWithSendgrid(input);
  },

  // backwards-compat alias
  async sendWithRetry(input: EmailSendInput, maxRetries = 3): Promise<EmailResult> {
    let last: EmailResult = { success: false, error: "not attempted" };
    for (let i = 1; i <= maxRetries; i++) {
      const res = await this.send(input);
      if (res.success) return res;
      last = res;
      await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, i - 1), 8000)));
    }
    return { success: false, error: `Failed after ${maxRetries} retries: ${last.error}` };
  },
};

export default email;