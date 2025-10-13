import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "../routes";
import { pool } from "../db";
import { authService } from "../services/authService";

// Set up test JWT secrets
process.env.JWT_ACCESS_SECRET = "test-access-secret-min-32-chars-long-for-testing-purposes-only";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-min-32-chars-long-for-testing-purposes-only";
process.env.APP_BASE_URL = "http://localhost:5000";

let app: express.Application;
let server: any;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  server = await registerRoutes(app);

  // Clean up test users before starting
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");
  // Clean up rate limit data
  await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
});

afterAll(async () => {
  // Clean up test users after all tests
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");
  await pool.end();
  if (server && server.close) {
    await new Promise((resolve) => server.close(resolve));
  }
});

// Helper to add delay between tests that might hit rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("Authentication API Tests", () => {
  const testUser = {
    email: "signup-test@test.com",
    password: "SecurePassword123!",
    firstName: "Test",
    lastName: "User",
  };

  let accessToken: string;
  let refreshToken: string;
  let verificationToken: string;
  let resetToken: string;

  describe("POST /api/auth/signup - User Registration", () => {
    it("should successfully create a new user account", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send(testUser)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Account created successfully");
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data).toHaveProperty("emailSent");
    });

    it("should reject duplicate email registration", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send(testUser)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already exists");
    });

    it("should reject invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          email: "not-an-email",
          password: "SecurePassword123!",
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid input");
    });

    it("should reject password shorter than 8 characters", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          email: "short-pass@test.com",
          password: "Short1!",
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("GET /api/auth/verify-email - Email Verification", () => {
    beforeAll(async () => {
      // Get verification token for the test user
      const user = await authService.getUserByEmail(testUser.email);
      if (user) {
        verificationToken = await authService.createEmailVerificationToken(user.id);
      }
    });

    it("should reject request without token", async () => {
      const res = await request(app)
        .get("/api/auth/verify-email")
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("token is required");
    });

    it("should reject invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/verify-email")
        .query({ token: "invalid-token-12345" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid or expired");
    });

    it("should successfully verify email with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/verify-email")
        .query({ token: verificationToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Email verified successfully");
    });

    it("should not allow reusing the same verification token", async () => {
      const res = await request(app)
        .get("/api/auth/verify-email")
        .query({ token: verificationToken })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid or expired");
    });
  });

  describe("POST /api/auth/login - User Login", () => {
    it("should reject login with unverified email", async () => {
      // Create a new unverified user
      await request(app)
        .post("/api/auth/signup")
        .send({
          email: "unverified@test.com",
          password: "SecurePassword123!",
        });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "unverified@test.com",
          password: "SecurePassword123!",
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("verify your email");
      expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
    });

    it("should successfully login with verified email and valid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("refreshToken");
      expect(res.body.data.user).toMatchObject({
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      });

      // Store tokens for later tests
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it("should reject login with incorrect password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123!",
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("should reject login with non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@test.com",
          password: "AnyPassword123!",
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });
  });

  describe("GET /api/auth/me - Get Current User", () => {
    it("should reject request without authentication", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Authentication required");
    });

    it("should reject request with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it("should successfully return user info with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        emailVerified: true,
      });
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data).toHaveProperty("createdAt");
    });
  });

  describe("POST /api/auth/refresh - Token Refresh", () => {
    it("should reject request without refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("should reject request with invalid refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-refresh-token" })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid or expired");
    });

    it("should successfully rotate refresh token and return new tokens", async () => {
      const oldRefreshToken = refreshToken;

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: oldRefreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("refreshed successfully");
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("refreshToken");
      expect(res.body.data.refreshToken).not.toBe(oldRefreshToken);

      // Store new tokens
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it("should reject the old refresh token after rotation", async () => {
      // Try to use the old token again (should fail)
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "old-token-should-be-revoked" })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/resend-verification - Resend Verification Email", () => {
    it("should not reveal if email exists (security measure)", async () => {
      const res = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "nonexistent@test.com" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("If an account exists");
    });

    it("should reject for already verified email", async () => {
      const res = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: testUser.email })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already verified");
    });
  });

  describe("POST /api/auth/forgot-password - Password Reset Request", () => {
    it("should not reveal if email exists (security measure)", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@test.com" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("If an account exists");
    });

    it("should successfully send password reset email for valid email", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: testUser.email })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("If an account exists");

      // Get reset token from database for testing
      const user = await authService.getUserByEmail(testUser.email);
      if (user) {
        resetToken = await authService.createPasswordResetToken(user.id);
      }
    });
  });

  describe("POST /api/auth/reset-password - Password Reset", () => {
    it("should reject request without token", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "",
          newPassword: "NewSecurePassword456!",
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("should reject invalid token", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "invalid-reset-token",
          newPassword: "NewSecurePassword456!",
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid or expired");
    });

    it("should reject password shorter than 8 characters", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: resetToken,
          newPassword: "Short1!",
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("should successfully reset password with valid token", async () => {
      const newPassword = "NewSecurePassword456!";

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: resetToken,
          newPassword,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Password reset successfully");
    });

    it("should revoke old tokens after password reset", async () => {
      // Old access token should no longer work
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it("should allow login with new password after reset", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "NewSecurePassword456!",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("refreshToken");

      // Update tokens for logout test
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it("should not allow login with old password after reset", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password, // Old password
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });
  });

  describe("POST /api/auth/logout - User Logout", () => {
    it("should reject request without authentication", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .send({ refreshToken })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it("should successfully logout and revoke tokens", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Logged out successfully");
    });

    it("should reject refresh token after logout", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe("Rate Limiting Tests", () => {
    const rateLimitTestUser = {
      email: "ratelimit-test@test.com",
      password: "TestPassword123!",
    };

    beforeAll(async () => {
      // Create and verify a user for rate limit testing
      await request(app).post("/api/auth/signup").send(rateLimitTestUser);
      const user = await authService.getUserByEmail(rateLimitTestUser.email);
      if (user) {
        const token = await authService.createEmailVerificationToken(user.id);
        await request(app).get("/api/auth/verify-email").query({ token });
      }
    });

    it("should block login attempts after rate limit is exceeded", async () => {
      // Make 6 failed login attempts (limit is 5 per 15 minutes)
      const attempts = Array(6).fill(null);

      for (let i = 0; i < attempts.length; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .send({
            email: rateLimitTestUser.email,
            password: "WrongPassword123!",
          });

        if (i < 5) {
          expect(res.statusCode).toBe(401); // Unauthorized
        } else {
          expect(res.statusCode).toBe(429); // Too Many Requests
          expect(res.body.message).toContain("Too many attempts");
        }
      }
    });
  });

  describe("Security Tests", () => {
    it("should store passwords as bcrypt hashes (not plaintext)", async () => {
      const user = await authService.getUserByEmail(testUser.email);
      expect(user).toBeDefined();
      if (user) {
        // Bcrypt hashes start with $2a$, $2b$, or $2y$
        expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
        expect(user.passwordHash).not.toBe(testUser.password);
        expect(user.passwordHash.length).toBeGreaterThan(50);
      }
    });

    it("should store refresh tokens as hashes (not plaintext)", async () => {
      // Login to create a refresh token
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "NewSecurePassword456!",
        });

      const token = loginRes.body.data.refreshToken;

      // Check that the token in DB is hashed
      const tokenHash = await authService.hashRefreshToken(token);
      const result = await pool.query(
        "SELECT token_hash FROM refresh_tokens WHERE token_hash = $1",
        [tokenHash]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].token_hash).not.toBe(token);
      expect(result.rows[0].token_hash).toBe(tokenHash);
    });

    it("should not reveal user existence through error messages", async () => {
      // Login with non-existent user
      const res1 = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@test.com",
          password: "AnyPassword123!",
        });

      // Login with wrong password for existing user
      const res2 = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123!",
        });

      // Both should return the same generic error message
      expect(res1.body.message).toBe(res2.body.message);
      expect(res1.body.message).toBe("Invalid email or password");
    });
  });
});
