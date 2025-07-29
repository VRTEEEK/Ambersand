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
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const taskLink = taskId ? `${baseUrl}/my-tasks?task=${taskId}` : `${baseUrl}/my-tasks`;
      
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

    deadlineReminder: (userName: string, taskTitle: string, dueDate: string, language: 'en' | 'ar' = 'en') => {
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      
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
              <a href="${baseUrl}/my-tasks" style="background-color: #ea580c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">عرض المهمة</a>
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
            <a href="${baseUrl}/my-tasks" style="background-color: #ea580c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Task</a>
          </div>
        `
      };
    },

    statusUpdate: (userName: string, taskTitle: string, oldStatus: string, newStatus: string, language: 'en' | 'ar' = 'en') => {
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      
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
              <a href="${baseUrl}/my-tasks" style="background-color: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">عرض التفاصيل</a>
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
            <a href="${baseUrl}/my-tasks" style="background-color: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Details</a>
          </div>
        `
      };
    }
  }
};