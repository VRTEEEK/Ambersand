import sgMail from '@sendgrid/mail';

// Test SendGrid directly with environment variables
async function testSendGrid() {
  try {
    // Check environment variables
    console.log('Environment check:');
    console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET');
    console.log('SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');
    console.log('SENDGRID_FROM_NAME:', process.env.SENDGRID_FROM_NAME || 'NOT SET');
    console.log('APP_BASE_URL:', process.env.APP_BASE_URL || 'NOT SET');

    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is not configured');
    }

    // Configure SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@ambersand.app';
    const fromName = process.env.SENDGRID_FROM_NAME || 'Ambersand Compliance';

    console.log('Sending test email...');

    // Try with a known working email - let's try the account email
    const workingEmails = [
      'mohamed@vrteek.com', // Try your own email as sender
      'info@ambersand.app',
      'noreply@vrteek.com'
    ];
    
    console.log('Trying different sender emails...');
    
    for (const testFromEmail of workingEmails) {
      try {
        console.log(`Testing with sender: ${testFromEmail}`);
        
        const msg = {
          to: 'mohamed@vrteek.com',
          from: {
            email: testFromEmail,
            name: fromName
          },
      subject: 'SendGrid Test from Ambersand',
      text: 'This is a test email to verify SendGrid configuration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>SendGrid Test Email</h2>
          <p>Hello Mohamed,</p>
          <p>This is a test email to verify that the SendGrid email system is configured correctly for Ambersand Compliance.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>From Email: ${fromEmail}</li>
            <li>From Name: ${fromName}</li>
            <li>Base URL: ${process.env.APP_BASE_URL}</li>
          </ul>
          <p>If you receive this email, the SendGrid integration is working properly!</p>
          <p>Best regards,<br>Ambersand Team</p>
        </div>
      `
    };

    const response = await sgMail.send(msg);
    
    console.log('Email sent successfully!');
    console.log('Message ID:', response[0]?.headers?.['x-message-id']);
    console.log('Status Code:', response[0]?.statusCode);
    
  } catch (error) {
    console.error('SendGrid test failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Response body:', error.response?.body);
  }
}

testSendGrid();