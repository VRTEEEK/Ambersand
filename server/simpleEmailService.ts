import sgMail from '@sendgrid/mail';

// Configure SendGrid with strict validation
if (!process.env.SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY missing");
if (!process.env.SENDGRID_FROM_EMAIL) throw new Error("SENDGRID_FROM_EMAIL missing (must be verified)");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

interface SimpleEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const simpleEmailService = {
  async sendEmail(options: SimpleEmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const msg = {
        to: options.to,
        from: `${process.env.SENDGRID_FROM_NAME || 'Ambersand'} <${process.env.SENDGRID_FROM_EMAIL}>`,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      console.log('Sending simple email via SendGrid:', {
        to: msg.to,
        subject: msg.subject,
        from: msg.from,
        hasHtml: !!msg.html
      });

      await sgMail.send(msg);
      console.log('Email sent successfully');
      return { success: true };
    } catch (error: any) {
      console.error('SendGrid simple email error:', error?.response?.body || error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }
};