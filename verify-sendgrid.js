import fetch from 'node-fetch';

async function checkSendGridSenders() {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY not found');
    return;
  }

  try {
    console.log('🔍 Checking verified senders in SendGrid...\n');
    
    const response = await fetch('https://api.sendgrid.com/v3/verified_senders', {
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('❌ Could not fetch verified senders');
      console.log('Status:', response.status, response.statusText);
      
      // Alternative: Check sender identities
      console.log('\n🔍 Checking sender identities instead...');
      
      const identityResponse = await fetch('https://api.sendgrid.com/v3/senders', {
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (identityResponse.ok) {
        const identities = await identityResponse.json();
        console.log('📧 Available sender identities:');
        identities.forEach(sender => {
          console.log(`  - ${sender.from.email} (${sender.from.name}) - Verified: ${sender.verified}`);
        });
      } else {
        console.log('❌ Could not fetch sender identities either');
        console.log('Status:', identityResponse.status, identityResponse.statusText);
      }
      return;
    }

    const senders = await response.json();
    
    if (senders.length === 0) {
      console.log('⚠️  No verified senders found in your SendGrid account');
      console.log('\n📋 To fix this, you need to:');
      console.log('1. Go to SendGrid Dashboard → Settings → Sender Authentication');
      console.log('2. Add and verify rakan@ambersand.ai as a sender');
      console.log('3. Complete the email verification process');
    } else {
      console.log('✅ Found verified senders:');
      senders.forEach(sender => {
        console.log(`  - ${sender.from_email} (${sender.from_name})`);
      });
      
      console.log(`\n📧 Update SENDGRID_FROM_EMAIL to one of these verified emails.`);
    }
    
  } catch (error) {
    console.error('Error checking SendGrid:', error.message);
  }
}

checkSendGridSenders();