import sgMail from '@sendgrid/mail';

async function findVerifiedSender() {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY not found');
    return;
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const testEmails = [
    'rakan@ambersand.ai'
  ];

  console.log('🔍 Testing different sender emails to find verified one...\n');

  for (const fromEmail of testEmails) {
    try {
      console.log(`Testing: ${fromEmail}`);
      
      const msg = {
        to: 'mohamed@vrteek.com',
        from: {
          email: fromEmail,
          name: 'Ambersand Compliance'
        },
        subject: `Email Test from ${fromEmail}`,
        html: `<p>Test email from ${fromEmail} to verify SendGrid sender identity.</p>`
      };

      await sgMail.send(msg);
      console.log(`✅ SUCCESS! ${fromEmail} is verified and working\n`);
      
      // Update the environment variable suggestion
      console.log(`📧 Use this verified email: SENDGRID_FROM_EMAIL=${fromEmail}`);
      break;
      
    } catch (error) {
      console.log(`❌ Failed: ${fromEmail}`);
      if (error.message.includes('verified Sender Identity')) {
        console.log('   Reason: Not verified in SendGrid');
      } else {
        console.log(`   Reason: ${error.message}`);
      }
    }
  }
}

findVerifiedSender();