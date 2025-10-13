import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { db } from "../db";
import { authUsers, emailVerificationTokens, passwordResetTokens, refreshTokens } from "@shared/authSchema";
import { eq, and, gt } from "drizzle-orm";
import type { AuthUser } from "@shared/authSchema";

// JWT Configuration
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-this-secret-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "change-this-refresh-secret-in-production";
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days
const BCRYPT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}

export const authService = {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  },

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  /**
   * Generate access token (short-lived)
   */
  generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_ACCESS_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: "ambersand-api",
      audience: "ambersand-app",
    });
  },

  /**
   * Generate refresh token (long-lived)
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString("hex");
  },

  /**
   * Hash refresh token for storage
   */
  async hashRefreshToken(token: string): Promise<string> {
    return crypto.createHash("sha256").update(token).digest("hex");
  },

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
        issuer: "ambersand-api",
        audience: "ambersand-app",
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new Error("Invalid or expired access token");
    }
  },

  /**
   * Create a new user with hashed password
   */
  async createUser(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    organizationId?: string
  ): Promise<AuthUser> {
    const passwordHash = await this.hashPassword(password);
    const normalizedEmail = email.toLowerCase().trim();
    const userId = nanoid();

    const [user] = await db
      .insert(authUsers)
      .values({
        id: userId,
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        organizationId,
        emailVerified: false,
      })
      .returning();

    console.log(`✅ Created new auth user: ${user.email} (ID: ${user.id})`);
    return user;
  },

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<AuthUser | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const users = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, normalizedEmail))
      .limit(1);

    return users[0] || null;
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<AuthUser | null> {
    const users = await db.select().from(authUsers).where(eq(authUsers.id, userId)).limit(1);
    return users[0] || null;
  },

  /**
   * Generate email verification token
   */
  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      userId,
      token,
      expiresAt,
    });

    console.log(`📧 Created email verification token for user ${userId}`);
    return token;
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<boolean> {
    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(and(eq(emailVerificationTokens.token, token), gt(emailVerificationTokens.expiresAt, new Date())))
      .limit(1);

    if (tokens.length === 0) {
      console.warn(`❌ Invalid or expired email verification token: ${token}`);
      return false;
    }

    const verificationToken = tokens[0];

    // Mark email as verified
    await db
      .update(authUsers)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, verificationToken.userId));

    // Delete the token
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, verificationToken.id));

    console.log(`✅ Email verified for user ${verificationToken.userId}`);
    return true;
  },

  /**
   * Create password reset token
   */
  async createPasswordResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
      used: false,
    });

    console.log(`🔑 Created password reset token for user ${userId}`);
    return token;
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (tokens.length === 0) {
      console.warn(`❌ Invalid or expired password reset token: ${token}`);
      return false;
    }

    const resetToken = tokens[0];

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update user password
    await db
      .update(authUsers)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, resetToken.userId));

    // Mark token as used
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, resetToken.id));

    // Revoke all refresh tokens for this user (force re-login)
    await this.revokeAllUserTokens(resetToken.userId);

    console.log(`✅ Password reset for user ${resetToken.userId}`);
    return true;
  },

  /**
   * Store refresh token (hashed)
   */
  async storeRefreshToken(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const tokenHash = await this.hashRefreshToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    console.log(`🔄 Stored refresh token for user ${userId}`);
  },

  /**
   * Verify and rotate refresh token
   */
  async rotateRefreshToken(token: string): Promise<TokenPair | null> {
    const tokenHash = await this.hashRefreshToken(token);

    const tokens = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.revoked, false),
          gt(refreshTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (tokens.length === 0) {
      console.warn(`❌ Invalid or expired refresh token`);
      return null;
    }

    const refreshToken = tokens[0];

    // Get user
    const user = await this.getUserById(refreshToken.userId);
    if (!user) {
      console.error(`❌ User not found for refresh token: ${refreshToken.userId}`);
      return null;
    }

    // Revoke old refresh token
    await db
      .update(refreshTokens)
      .set({
        revoked: true,
        revokedAt: new Date(),
      })
      .where(eq(refreshTokens.id, refreshToken.id));

    // Generate new token pair
    const newAccessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId || undefined,
    });

    const newRefreshToken = this.generateRefreshToken();

    // Store new refresh token
    await this.storeRefreshToken(user.id, newRefreshToken, refreshToken.ipAddress || undefined, refreshToken.userAgent || undefined);

    // Update last used
    await db.update(refreshTokens).set({ lastUsedAt: new Date() }).where(eq(refreshTokens.id, refreshToken.id));

    console.log(`✅ Rotated refresh token for user ${user.id}`);
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({
        revoked: true,
        revokedAt: new Date(),
      })
      .where(eq(refreshTokens.userId, userId));

    console.log(`🔒 Revoked all refresh tokens for user ${userId}`);
  },

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await db
      .update(authUsers)
      .set({
        lastLoginAt: new Date(),
      })
      .where(eq(authUsers.id, userId));
  },

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();

    // Delete expired email verification tokens
    await db.delete(emailVerificationTokens).where(gt(emailVerificationTokens.expiresAt, now));

    // Delete used or expired password reset tokens
    await db
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.used, true), gt(passwordResetTokens.expiresAt, now)));

    // Delete expired refresh tokens
    await db.delete(refreshTokens).where(gt(refreshTokens.expiresAt, now));

    console.log(`🧹 Cleaned up expired tokens`);
  },
};
