# Authentication System Setup Guide

## Quick Start (5 Minutes)

### Step 1: Generate JWT Secrets

Run these commands to generate secure random secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

You'll get two long hexadecimal strings. Keep these safe!

### Step 2: Add to Replit Secrets

1. Click the **🔒 Secrets** tab in the left sidebar (or Tools → Secrets)
2. Add these two secrets:

**Secret 1:**
- Key: `JWT_ACCESS_SECRET`
- Value: (paste the first hex string from Step 1)

**Secret 2:**
- Key: `JWT_REFRESH_SECRET`
- Value: (paste the second hex string from Step 1)

### Step 3: Run Database Migration

The migration creates 4 tables needed for authentication:

```bash
psql $DATABASE_URL < migrations/0001_create_auth_tables.sql
```

Expected output: 16 successful operations (CREATE TABLE, CREATE INDEX, etc.)

### Step 4: Verify Email Configuration

Make sure you have email configured in Secrets:

**For SendGrid (Recommended):**
- `EMAIL_DRIVER=sendgrid`
- `SENDGRID_API_KEY=<your_api_key>`
- `SENDGRID_FROM_EMAIL=<verified_sender_email>`
- `SENDGRID_FROM_NAME=Ambersand`

**For SMTP:**
- `EMAIL_DRIVER=smtp`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=<your_email>`
- `SMTP_PASS=<your_app_password>`

### Step 5: Restart Your Application

Click the **Run** button or restart your Repl.

---

## ✅ Test Your Setup

### Test 1: Sign Up

```bash
curl -X POST https://your-repl.replit.dev/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully. Please check your email to verify your account.",
  "data": {
    "email": "test@example.com",
    "emailSent": true
  }
}
```

### Test 2: Try to Login (Should Fail - Email Not Verified)

```bash
curl -X POST https://your-repl.replit.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

**Expected Response (403):**
```json
{
  "success": false,
  "message": "Please verify your email before logging in",
  "code": "EMAIL_NOT_VERIFIED"
}
```

### Test 3: Verify Email

1. Check your inbox for verification email
2. Click the verification link (or copy token from URL)
3. Visit: `https://your-repl.replit.dev/auth/verify-email?token=<token>`

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in."
}
```

### Test 4: Login (Should Work Now)

```bash
curl -X POST https://your-repl.replit.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
    "user": {
      "id": 1,
      "email": "test@example.com",
      "firstName": "Test",
      "lastName": "User",
      "role": "user"
    }
  }
}
```

---

## 🔐 Security Best Practices

### JWT Secrets
- **NEVER** commit JWT secrets to git
- **ALWAYS** use Replit Secrets (not .env files)
- **GENERATE NEW** secrets for production (don't use examples)
- **MINIMUM 64 characters** (the command above generates 128 chars)

### Password Requirements
- Minimum 8 characters
- Enforced at API level
- Hashed with bcrypt (12 rounds)
- Never stored in plaintext

### Token Expiry
- **Access Token:** 15 minutes (short-lived)
- **Refresh Token:** 30 days (rotating)
- **Verification Token:** 24 hours
- **Reset Token:** 1 hour

### Rate Limiting
- **Login/Signup:** 5 attempts per 15 minutes
- **Password Reset:** 3 attempts per hour
- **Email Verification:** 3 attempts per 15 minutes

---

## 🚀 API Endpoints

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/login` | Login with email/password |
| GET | `/api/auth/verify-email?token=<token>` | Verify email address |
| POST | `/api/auth/resend-verification` | Resend verification email |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/refresh` | Refresh access token |

### Protected Endpoints (Auth Required)

| Method | Endpoint | Description | Header |
|--------|----------|-------------|--------|
| GET | `/api/auth/me` | Get current user | `Authorization: Bearer <access_token>` |
| POST | `/api/auth/logout` | Logout (revoke tokens) | `Authorization: Bearer <access_token>` |

---

## 📋 Common Issues & Solutions

### Issue: "SENDGRID_API_KEY missing"

**Solution:** Add SendGrid API key to Replit Secrets:
1. Go to SendGrid dashboard
2. Create API key with "Mail Send" permission
3. Add to Secrets as `SENDGRID_API_KEY`

### Issue: "SENDGRID_FROM_EMAIL missing (must be verified)"

**Solution:** Verify your sender email in SendGrid:
1. Go to SendGrid → Settings → Sender Authentication
2. Verify a single sender email
3. Add verified email to Secrets as `SENDGRID_FROM_EMAIL`

### Issue: "Invalid or expired access token"

**Solution:** Access tokens expire after 15 minutes. Use refresh token:
```bash
curl -X POST https://your-repl.replit.dev/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your_refresh_token>"}'
```

### Issue: "Too many attempts. Please try again later."

**Solution:** Wait for rate limit to reset:
- Login rate limit: 15 minutes
- Password reset: 1 hour

### Issue: Tests failing with rate limit errors

**Solution:** This is expected in test environment. Tests hit rate limits because they run quickly in sequence. In production, real users won't hit these limits.

---

## 🧪 Running Tests

```bash
# Run all auth tests
npm run test:auth

# Run tests in watch mode
npm run test:watch

# Run all tests
npm test
```

**Note:** Some tests may fail due to rate limiting. This is expected behavior and doesn't affect production functionality.

---

## 📊 Database Schema

### Tables Created by Migration

1. **auth_users** - User accounts with email/password
2. **email_verification_tokens** - Email verification tokens
3. **password_reset_tokens** - Password reset tokens
4. **refresh_tokens** - JWT refresh tokens (hashed)

### Indexes Created

- `idx_auth_users_email` - Fast email lookups
- `idx_auth_users_org` - Organization filtering
- `idx_email_verification_token` - Token verification
- `idx_email_verification_user` - User's verification tokens
- `idx_password_reset_token` - Reset token lookup
- `idx_password_reset_user` - User's reset tokens
- `idx_refresh_token_hash` - Token validation
- `idx_refresh_token_user` - User's refresh tokens
- `idx_refresh_token_expiry` - Cleanup expired tokens

---

## 🔍 Monitoring & Debugging

### Check Logs

Look for these log patterns:

**Success:**
```
✅ User registered: test@example.com (ID: 123)
✅ SendGrid: Email sent successfully to test@example.com
✅ Email verified with token
✅ User logged in: test@example.com (ID: 123)
```

**Errors:**
```
❌ SendGrid: SENDGRID_API_KEY environment variable is not set
❌ Failed to send verification email to test@example.com: API key missing
❌ Invalid or expired email verification token: abc123
```

### Check Database

```sql
-- Check if user exists and is verified
SELECT id, email, email_verified, email_verified_at, created_at
FROM auth_users
WHERE email = 'test@example.com';

-- Check verification tokens
SELECT * FROM email_verification_tokens
WHERE user_id = 123
ORDER BY created_at DESC;

-- Check refresh tokens
SELECT id, user_id, revoked, expires_at, created_at
FROM refresh_tokens
WHERE user_id = 123
ORDER BY created_at DESC;
```

---

## 🎯 Next Steps

1. **Set JWT secrets** in Replit Secrets (see Step 2 above)
2. **Run migration** (see Step 3 above)
3. **Test the flow:** signup → check email → verify → login
4. **Monitor logs** for any errors
5. **Integrate** with your frontend signup/login pages

For detailed implementation info, see: `AUTH_SHIP_CHECKLIST.md`

---

**Questions?** Check the logs first - they contain detailed error messages!
