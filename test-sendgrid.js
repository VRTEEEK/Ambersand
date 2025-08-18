// Quick test script to verify SendGrid integration
import { emailService } from './server/emailService.ts';

async function testSendGrid() {
  console.log('🧪 Testing SendGrid email integration...');
  
  try {
    // Test basic email sending
    const result = await emailService.sendEmail({
      to: 'mohamed@vrteek.com',
      subject: 'SendGrid Integration Test',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>SendGrid Integration Test</h2>
          <p>This is a test email to verify that SendGrid is working correctly in the Ambersand platform.</p>
          <p>✅ Email service successfully migrated from Resend to SendGrid</p>
          <p>✅ Base URL properly configured: ${emailService.getBaseUrl()}</p>
          <p>✅ Retry logic implemented for better reliability</p>
        </div>
      `
    });
    
    if (result.success) {
      console.log('✅ SendGrid test email sent successfully!');
      console.log('Message ID:', result.messageId);
    } else {
      console.log('❌ SendGrid test failed:', result.error);
    }
    
    // Test invitation email template
    const inviteResult = await emailService.sendInvitationEmail(
      'test@example.com',
      'Test Admin',
      'Ambersand Test Organization',
      'Welcome to our compliance management platform!',
      `${emailService.getBaseUrl()}/join?token=test123&email=test@example.com`
    );
    
    console.log('📧 Invitation email test result:', inviteResult.success ? 'SUCCESS' : 'FAILED');
    
  } catch (error) {
    console.error('❌ SendGrid test error:', error);
  }
}

// Run the test
testSendGrid();