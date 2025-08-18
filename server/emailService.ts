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
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@vrteek.com';
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
          {
            type: 'text/html',
            value: html
          }
        ];

        // Add plain text fallback
        if (text) {
          mailOptions.content.push({
            type: 'text/plain',
            value: text
          });
        } else {
          // Auto-generate plain text from HTML
          const plainText = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          mailOptions.content.push({
            type: 'text/plain',
            value: plainText
          });
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
        if (result.success) {
          return result;
        }
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
   */
  getBaseUrl(): string {
    return process.env.APP_BASE_URL || 
           process.env.REPLIT_CLUSTER && process.env.REPLIT_CLUSTER !== 'picard' 
             ? `https://${process.env.REPLIT_CLUSTER}.replit.dev` 
             : 'http://localhost:5000';
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
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invitation to ${organizationName}</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 0;">
              <!-- Header -->
              <div style="background-color: #2699A6; padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                  Ambersand
                </h1>
                <p style="color: #e0f7fa; margin: 10px 0 0 0; font-size: 16px;">
                  Compliance Management Platform
                </p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <h2 style="color: #2699A6; margin: 0 0 20px 0; font-size: 24px;">
                  You've been invited to join ${organizationName}
                </h2>
                
                <p style="margin: 0 0 20px 0; font-size: 16px;">
                  Hello,
                </p>
                
                <p style="margin: 0 0 20px 0; font-size: 16px;">
                  <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on the Ambersand compliance management platform.
                </p>
                
                ${personalMessage ? `
                <div style="background-color: #f8f9fa; border-left: 4px solid #2699A6; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; font-style: italic; color: #555;">
                    "${personalMessage}"
                  </p>
                </div>
                ` : ''}
                
                <p style="margin: 20px 0; font-size: 16px;">
                  Click the button below to accept your invitation and set up your account:
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${inviteUrl}" 
                     style="background-color: #2699A6; 
                            color: white; 
                            padding: 15px 30px; 
                            text-decoration: none; 
                            border-radius: 6px; 
                            display: inline-block; 
                            font-weight: bold; 
                            font-size: 16px;
                            box-shadow: 0 2px 4px rgba(38, 153, 166, 0.3);">
                    Accept Invitation
                  </a>
                </div>
                
                <p style="margin: 20px 0; font-size: 14px; color: #666;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                
                <div style="background-color: #f8f9fa; 
                            padding: 15px; 
                            border: 1px solid #dee2e6; 
                            border-radius: 4px; 
                            word-break: break-all; 
                            font-family: monospace; 
                            font-size: 14px; 
                            color: #495057;">
                  ${inviteUrl}
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background-color: #f8f9fa; 
                          padding: 30px; 
                          text-align: center; 
                          border-top: 1px solid #dee2e6;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                  <strong>Note:</strong> This invitation will expire in 7 days.
                </p>
                
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                  © ${new Date().getFullYear()} Ambersand. All rights reserved.
                </p>
                
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                  If you have any questions, please contact your system administrator.
                </p>
              </div>
            </div>
          </body>
          </html>
        `
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
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; direction: rtl;">
          <h2>إعادة تعيين كلمة المرور</h2>
          <p>مرحباً ${userName}،</p>
          <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بك في منصة Ambersand.</p>
          <p>انقر على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
          <a href="${resetUrl}" style="background-color: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">إعادة تعيين كلمة المرور</a>
          <p style="margin-top: 20px; color: #666;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني.</p>
        </div>
      `
    } : {
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset Request</h2>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password for your Ambersand account.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}" style="background-color: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Reset Password</a>
          <p style="margin-top: 20px; color: #666;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `
    };

    return await this.sendEmailWithRetry({
      to: toEmail,
      subject: template.subject,
      html: template.html,
    });
  }
};