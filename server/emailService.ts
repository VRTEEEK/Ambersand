import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export const emailService = {
  async sendEmail({ to, subject, html, text }: EmailOptions) {
    try {
      console.log('Attempting to send email:', { to, subject, from: 'Ambersand <noreply@resend.dev>' });
      
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }

      const { data, error } = await resend.emails.send({
        from: 'Ambersand <noreply@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
      });

      if (error) {
        console.error('Resend API error:', error);
        throw new Error(`Email service error: ${error.message || JSON.stringify(error)}`);
      }

      console.log('Email sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  },

  // Email templates
  templates: {
    taskAssignment: (userName: string, taskTitle: string, dueDate: string, projectName: string, language: 'en' | 'ar' = 'en', taskId?: number) => {
      // Auto-detect production URL based on environment
      const baseUrl = process.env.BASE_URL || 
                     (process.env.REPLIT_CLUSTER ? 'https://ambersand-v1.replit.app' : 'http://localhost:5000');
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
      // Auto-detect production URL based on environment
      const baseUrl = process.env.BASE_URL || 
                     (process.env.REPLIT_CLUSTER ? 'https://ambersand-v1.replit.app' : 'http://localhost:5000');
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
      // Auto-detect production URL based on environment
      const baseUrl = process.env.BASE_URL || 
                     (process.env.REPLIT_CLUSTER ? 'https://ambersand-v1.replit.app' : 'http://localhost:5000');
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

  // User invitation email
  async sendInvitationEmail(toEmail: string, options: {
    inviterName: string;
    organizationName: string;
    personalMessage?: string;
    inviteUrl: string;
  }) {
    const { inviterName, organizationName, personalMessage, inviteUrl } = options;
    
    console.log('Sending invitation email:', { toEmail, inviterName, organizationName, inviteUrl });

    const template = this.templates.userInvitation(inviterName, organizationName, personalMessage || '', inviteUrl);
    
    return await this.sendEmail({
      to: toEmail,
      subject: template.subject,
      html: template.html,
    });
  }
};