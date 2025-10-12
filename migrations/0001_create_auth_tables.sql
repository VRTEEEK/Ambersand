-- Migration: Create Email Authentication Tables
-- Created: 2025-01-11
-- Description: Adds tables for email/password authentication with JWT tokens

-- 1. Auth Users Table (email + password)
CREATE TABLE IF NOT EXISTS "auth_users" (
  "id" SERIAL PRIMARY KEY,
  "email" VARCHAR(256) NOT NULL UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "email_verified" BOOLEAN DEFAULT FALSE NOT NULL,
  "email_verified_at" TIMESTAMP WITH TIME ZONE,
  "first_name" VARCHAR(128),
  "last_name" VARCHAR(128),
  "organization_id" VARCHAR(64),
  "role" VARCHAR(32) DEFAULT 'user' NOT NULL,
  "language" VARCHAR(10) DEFAULT 'en',
  "is_active" BOOLEAN DEFAULT TRUE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "last_login_at" TIMESTAMP WITH TIME ZONE
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS "idx_auth_users_email" ON "auth_users"("email");
CREATE INDEX IF NOT EXISTS "idx_auth_users_organization" ON "auth_users"("organization_id");

-- 2. Email Verification Tokens
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "token" VARCHAR(128) NOT NULL UNIQUE,
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS "idx_email_verification_token" ON "email_verification_tokens"("token");
CREATE INDEX IF NOT EXISTS "idx_email_verification_user" ON "email_verification_tokens"("user_id");

-- 3. Password Reset Tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "token" VARCHAR(128) NOT NULL UNIQUE,
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "used" BOOLEAN DEFAULT FALSE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS "idx_password_reset_token" ON "password_reset_tokens"("token");
CREATE INDEX IF NOT EXISTS "idx_password_reset_user" ON "password_reset_tokens"("user_id");

-- 4. Refresh Tokens (hashed for security)
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "token_hash" VARCHAR(255) NOT NULL UNIQUE,
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "last_used_at" TIMESTAMP WITH TIME ZONE,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "revoked" BOOLEAN DEFAULT FALSE NOT NULL,
  "revoked_at" TIMESTAMP WITH TIME ZONE
);

-- Create indexes for fast token lookup and cleanup
CREATE INDEX IF NOT EXISTS "idx_refresh_token_hash" ON "refresh_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "idx_refresh_token_user" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "idx_refresh_token_expires" ON "refresh_tokens"("expires_at");
CREATE INDEX IF NOT EXISTS "idx_refresh_token_revoked" ON "refresh_tokens"("revoked");

-- Add trigger to update updated_at on auth_users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON "auth_users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
