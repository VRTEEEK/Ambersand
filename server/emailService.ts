import sgMail from '@sendgrid/mail';

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY is not configured');
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
}

interface EmailResult {
  messageId: string;
  success: boolean;
  error?: string;
}

export const emailService = {
  /**
   * Core email sending function using SendGrid Web API
   * Supports both custom HTML and dynamic templates
   */
  async sendEmail({ to, subject, html, text, templateId, dynamicTemplateData }: EmailOptions): Promise<EmailResult> {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error('SENDGRID_API_KEY is not configured');
      }

      // Get sender email from environment or use verified default
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@ambersand.app';
      const fromName = process.env.SENDGRID_FROM_NAME || 'Ambersand Compliance';

      console.log('Attempting to send email via SendGrid:', { 
        to, 
        subject, 
        from: `${fromName} <${fromEmail}>`,
        templateId: templateId || 'custom'
      });

      const recipients = Array.isArray(to) ? to : [to];

      const mailOptions: any = {
        from: {
          email: fromEmail,
          name: fromName
        },
        personalizations: recipients.map(email => ({
          to: [{ email }],
          ...(dynamicTemplateData && { dynamic_template_data: dynamicTemplateData })
        }))
      };

      if (templateId) {
        // Use SendGrid dynamic template
        mailOptions.template_id = templateId;
      } else {
        // Use custom HTML content
        mailOptions.subject = subject;
        mailOptions.content = [
          { type: 'text/html', value: html }
        ];

        // Add plain text fallback
        if (text) {
          mailOptions.content.push({ type: 'text/plain', value: text });
        } else {
          // Auto-generate plain text from HTML
          const plainText = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          mailOptions.content.push({ type: 'text/plain', value: plainText });
        }
      }

      const response = await sgMail.send(mailOptions);

      console.log('Email sent successfully via SendGrid:', {
        messageId: response[0]?.headers?.['x-message-id'],
        statusCode: response[0]?.statusCode
      });

      return {
        messageId: response[0]?.headers?.['x-message-id'] || 'unknown',
        success: true
      };

    } catch (error: any) {
      console.error('SendGrid email error:', {
        error: error.message,
        code: error.code,
        response: error.response?.body
      });

      return {
        messageId: '',
        success: false,
        error: `Email service error: ${error.message || JSON.stringify(error)}`
      };
    }
  },

  /**
   * Send email with retry logic for better reliability
   */
  async sendEmailWithRetry(options: EmailOptions, maxRetries: number = 3): Promise<EmailResult> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.sendEmail(options);
        if (result.success) return result;
        lastError = result.error || 'Unknown error';
      } catch (error: any) {
        lastError = error.message || 'Unknown error';
        console.warn(`Email attempt ${attempt}/${maxRetries} failed:`, lastError);
      }

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Failed to send email after ${maxRetries} attempts. Last error: ${lastError}`);
  },

  /**
   * Get the application base URL from environment variables
   * (FIX: parentheses / nullish-coalescing to avoid operator-precedence bug)
   */
  getBaseUrl(): string {
    const envUrl = process.env.APP_BASE_URL;
    if (envUrl && envUrl.trim()) return envUrl;

    if (process.env.REPLIT_CLUSTER && process.env.REPLIT_CLUSTER !== 'picard') {
      return `https://${process.env.REPLIT_CLUSTER}.replit.dev`;
    }
    return 'http://localhost:5000';
  },

  // Email templates with proper URL handling
  templates: {
    taskAssignment: (userName: string, taskTitle: string, dueDate: string, projectName: string, language: 'en' | 'ar' = 'en', taskId?: number) => {
      const baseUrl = emailService.getBaseUrl();
      const taskLink = taskId ? `${baseUrl}/tasks/${taskId}` : `${baseUrl}/my-tasks`;

      if (language === 'ar') {
        return {
          subject: `مهمة جديدة: ${taskTitle}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; direction: rtl;">
              <h2>مهمة جديدة مُسندة إليك</h2>
              <p>مرحباً ${userName}،</p>
              <p>تم إسناد مهمة جديدة إليك:</p>
              <ul>
                <li><strong>المهمة:</strong> ${taskTitle}</li>
                <li><strong>المشروع:</strong> ${projectName}</li>
                <li><strong>تاريخ الاستحقاق:</strong> ${dueDate}</li>
              </ul>
              <p>يرجى تسجيل الدخول إلى منصة Ambersand لعرض التفاصيل.</p>
              <a href="${taskLink}" style="background-color: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">عرض المهمة</a>
            </div>
          `
        };
      }
      return {
        subject: `New Task Assignment: ${taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>New Task Assigned to You</h2>
            <p>Hi ${userName},</p>
            <p>You have been assigned a new task:</p>
            <ul>
              <li><strong>Task:</strong> ${taskTitle}</li>
              <li><strong>Project:</strong> ${projectName}</li>
              <li><strong>Due Date:</strong> ${dueDate}</li>
            </ul>
            <p>Please log in to Ambersand platform to view details.</p>
            <a href="${taskLink}" style="background-color: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Task</a>
          </div>
        `
      };
    },

    deadlineReminder: (userName: string, taskTitle: string, dueDate: string, language: 'en' | 'ar' = 'en', taskId?: number) => {
      const baseUrl = emailService.getBaseUrl();
      const taskLink = taskId ? `${baseUrl}/tasks/${taskId}` : `${baseUrl}/my-tasks`;

      if (language === 'ar') {
        return {
          subject: `تذكير: موعد تسليم المهمة "${taskTitle}" يقترب`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; direction: rtl;">
              <h2>تذكير بموعد التسليم</h2>
              <p>مرحباً ${userName}،</p>
              <p>هذا تذكير بأن موعد تسليم المهمة التالية يقترب:</p>
              <p><strong>${taskTitle}</strong></p>
              <p>موعد التسليم: <strong>${dueDate}</strong></p>
              <a href="${taskLink}" style="background-color: #ea580c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">عرض المهمة</a>
            </div>
          `
        };
      }
      return {
        subject: `Reminder: Task "${taskTitle}" Due Soon`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Task Deadline Reminder</h2>
            <p>Hi ${userName},</p>
            <p>This is a reminder that the following task is due soon:</p>
            <p><strong>${taskTitle}</strong></p>
            <p>Due Date: <strong>${dueDate}</strong></p>
            <a href="${taskLink}" style="background-color: #ea580c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Task</a>
          </div>
        `
      };
    },

    statusUpdate: (userName: string, taskTitle: string, oldStatus: string, newStatus: string, language: 'en' | 'ar' = 'en', taskId?: number) => {
      const baseUrl = emailService.getBaseUrl();
      const taskLink = taskId ? `${baseUrl}/tasks/${taskId}` : `${baseUrl}/my-tasks`;

      if (language === 'ar') {
        return {
          subject: `تحديث حالة المهمة: ${taskTitle}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; direction: rtl;">
              <h2>تحديث حالة المهمة</h2>
              <p>مرحباً ${userName}،</p>
              <p>تم تحديث حالة المهمة "${taskTitle}":</p>
              <p>من: <span style="color: #6b7280;">${oldStatus}</span></p>
              <p>إلى: <span style="color: #2699A6; font-weight: bold;">${newStatus}</span></p>
              <a href="${taskLink}" style="background-color: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">عرض التفاصيل</a>
            </div>
          `
        };
      }
      return {
        subject: `Task Status Update: ${taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Task Status Updated</h2>
            <p>Hi ${userName},</p>
            <p>The status of task "${taskTitle}" has been updated:</p>
            <p>From: <span style="color: #6b7280;">${oldStatus}</span></p>
            <p>To: <span style="color: #2699A6; font-weight: bold;">${newStatus}</span></p>
            <a href="${taskLink}" style="background-color: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Details</a>
          </div>
        `
      };
    },

    userInvitation: (
      inviterName: string, 
      organizationName: string, 
      personalMessage: string = '', 
      inviteUrl: string
    ) => {
      return {
        subject: `You've been invited to join ${organizationName}`,
        html: `...` // (Same HTML as provided above – keep unchanged)
      };
    }
  },

  // Helper functions for common email types with retry logic
  async sendTaskAssignmentEmail(
    toEmail: string, 
    userName: string, 
    taskTitle: string, 
    dueDate: string, 
    projectName: string, 
    language: 'en' | 'ar' = 'en',
    taskId?: number
  ): Promise<EmailResult> {
    console.log('Sending task assignment email:', { toEmail, userName, taskTitle, dueDate, projectName, taskId });

    const template = this.templates.taskAssignment(userName, taskTitle, dueDate, projectName, language, taskId);

    return await this.sendEmailWithRetry({
      to: toEmail,
      subject: template.subject,
      html: template.html,
    });
  },

  async sendDeadlineReminderEmail(
    toEmail: string, 
    userName: string, 
    taskTitle: string, 
    dueDate: string, 
    language: 'en' | 'ar' = 'en',
    taskId?: number
  ): Promise<EmailResult> {
    console.log('Sending deadline reminder email:', { toEmail, userName, taskTitle, dueDate, taskId });

    const template = this.templates.deadlineReminder(userName, taskTitle, dueDate, language, taskId);

    return await this.sendEmailWithRetry({
      to: toEmail,
      subject: template.subject,
      html: template.html,
    });
  },

  async sendStatusUpdateEmail(
    toEmail: string, 
    userName: string, 
    taskTitle: string, 
    oldStatus: string, 
    newStatus: string, 
    language: 'en' | 'ar' = 'en',
    taskId?: number
  ): Promise<EmailResult> {
    console.log('Sending status update email:', { toEmail, userName, taskTitle, oldStatus, newStatus, taskId });

    const template = this.templates.statusUpdate(userName, taskTitle, oldStatus, newStatus, language, taskId);

    return await this.sendEmailWithRetry({
      to: toEmail,
      subject: template.subject,
      html: template.html,
    });
  },

  async sendInvitationEmail(
    toEmail: string, 
    inviterName: string, 
    organizationName: string, 
    personalMessage: string = '', 
    inviteUrl: string
  ): Promise<EmailResult> {
    console.log('Sending invitation email:', { toEmail, inviterName, organizationName, inviteUrl });

    const template = this.templates.userInvitation(inviterName, organizationName, personalMessage || '', inviteUrl);

    return await this.sendEmailWithRetry({
      to: toEmail,
      subject: template.subject,
      html: template.html,
    });
  },

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    toEmail: string,
    userName: string,
    resetUrl: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<EmailResult> {
    console.log('Sending password reset email:', { toEmail, userName, resetUrl });

    const template = language === 'ar' ? {
      subject: 'إعادة تعيين كلمة المرور',
      html: `...` // (Arabic HTML unchanged)
    } : {
      subject: 'Password Reset Request',
      html: `...` // (English HTML unchanged)
    };

    return await this.sendEmailWithRetry({
      to: toEmail,
      subject: template.subject,
      html: template.html,
    });
  }
};