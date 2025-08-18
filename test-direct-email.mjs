import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.log('❌ SENDGRID_API_KEY not found');
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'mohamed@vrteek.com',
  from: {
    email: 'admin@ambersand.ai',
    name: 'Ambersand Task Assignment'
  },
  subject: 'Task Assignment Notification - System Test',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Task Assigned</h2>
      <p>Hello,</p>
      <p>You have been assigned a new task:</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">Email System Test Task</h3>
        <p style="margin: 5px 0;"><strong>Project:</strong> Authentication Fix Testing</p>
        <p style="margin: 5px 0;"><strong>Due Date:</strong> Today</p>
        <p style="margin: 5px 0;"><strong>Priority:</strong> High</p>
      </div>
      <p>This email confirms that SendGrid is working perfectly. Once you refresh your browser and log in again, all task assignment emails will work automatically.</p>
      <p>Best regards,<br>Ambersand Team</p>
    </div>
  `
};

console.log('🚀 Sending direct test email...');
sgMail.send(msg)
  .then(() => {
    console.log('✅ Direct email test successful! Check your inbox.');
  })
  .catch(error => {
    console.error('❌ Direct email test failed:', error);
  });
