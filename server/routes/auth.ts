import { Router } from "express";
import { z } from "zod";
import { authService } from "../services/authService";
import emailService from "../emailService";
import { authRateLimiter, passwordResetRateLimiter, emailVerificationRateLimiter } from "../middleware/rateLimiter";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware";

const router = Router();

/**
 * POST /api/auth/signup
 * Register a new user with email and password
 */
router.post("/signup", authRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email("Invalid email address"),
      password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(128)
        .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
        .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
        .regex(/(?=.*\d)/, "Password must contain at least one number")
        .regex(/(?=.*[@$!%*?&#])/, "Password must contain at least one special character (@$!%*?&#)"),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    });

    const { email, password, firstName, lastName } = schema.parse(req.body);

    // Check if user already exists
    const existingUser = await authService.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Create user
    const user = await authService.createUser(email, password, firstName, lastName, "default");

    // Generate email verification token
    const verificationToken = await authService.createEmailVerificationToken(user.id);
    const verificationUrl = `${emailService.getBaseUrl()}/auth/verify-email?token=${verificationToken}`;

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(
      email,
      firstName || email.split("@")[0],
      verificationUrl
    );

    if (!emailResult.success) {
      console.error(`❌ Failed to send verification email to ${user.email}: ${emailResult.error}`);
      // Don't fail registration, just warn
    }

    console.log(`✅ User registered: ${user.email} (ID: ${user.id})`);

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Please check your email to verify your account.",
      data: {
        email: user.email,
        emailSent: emailResult.success,
      },
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: error.errors,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post("/login", authRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string(),
    });

    const { email, password } = schema.parse(req.body);

    // Get user
    const user = await authService.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      // Generic error message to prevent user enumeration
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isValidPassword = await authService.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Generate tokens
    const accessToken = authService.generateAccessToken({
      userId: user.id,
      email: email,
      role: user.role,
      organizationId: user.organizationId || undefined,
    });

    const refreshToken = authService.generateRefreshToken();

    // Store refresh token
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    await authService.storeRefreshToken(user.id, refreshToken, ipAddress, userAgent);

    // Update last login
    await authService.updateLastLogin(user.id);

    console.log(`✅ User logged in: ${user.email} (ID: ${user.id})`);

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
        },
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req, res) => {
  try {
    const schema = z.object({
      refreshToken: z.string(),
    });

    const { refreshToken } = schema.parse(req.body);

    // Rotate refresh token
    const tokenPair = await authService.rotateRefreshToken(refreshToken);
    if (!tokenPair) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    console.log(`✅ Token refreshed`);

    return res.json({
      success: true,
      message: "Token refreshed successfully",
      data: tokenPair,
    });
  } catch (error: any) {
    console.error("Token refresh error:", error);
    return res.status(401).json({
      success: false,
      message: "Token refresh failed",
    });
  }
});

/**
 * POST /api/auth/logout
 * Revoke refresh token (logout)
 */
router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      refreshToken: z.string(),
    });

    const { refreshToken } = schema.parse(req.body);
    const tokenHash = await authService.hashRefreshToken(refreshToken);

    // Revoke the specific token
    // Note: In a real implementation, you'd want to revoke just this token
    // For simplicity, we'll revoke all user tokens
    if (req.userId) {
      await authService.revokeAllUserTokens(req.userId);
    }

    console.log(`✅ User logged out: ${req.userEmail}`);

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
});

/**
 * GET /api/auth/verify-email
 * Verify email address with token
 */
router.get("/verify-email", async (req, res) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    const verified = await authService.verifyEmail(token);
    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    console.log(`✅ Email verified with token`);

    return res.json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error: any) {
    console.error("Email verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Email verification failed",
    });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post("/resend-verification", emailVerificationRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
    });

    const { email } = schema.parse(req.body);

    const user = await authService.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: "If an account exists with this email, a verification email has been sent.",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new verification token
    const verificationToken = await authService.createEmailVerificationToken(user.id);
    const verificationUrl = `${emailService.getBaseUrl()}/auth/verify-email?token=${verificationToken}`;

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(
      email,
      user.firstName || email.split("@")[0],
      verificationUrl
    );

    if (!emailResult.success) {
      console.error(`❌ Failed to resend verification email to ${user.email}: ${emailResult.error}`);
    }

    console.log(`✅ Verification email resent to ${user.email}`);

    return res.json({
      success: true,
      message: "If an account exists with this email, a verification email has been sent.",
    });
  } catch (error: any) {
    console.error("Resend verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post("/forgot-password", passwordResetRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
    });

    const { email } = schema.parse(req.body);

    const user = await authService.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Generate password reset token
    const resetToken = await authService.createPasswordResetToken(user.id);
    const resetUrl = `${emailService.getBaseUrl()}/auth/reset-password?token=${resetToken}`;

    // Send password reset email
    const emailResult = await emailService.sendPasswordResetEmail(
      email,
      user.firstName || email.split("@")[0],
      resetUrl,
      user.language as "en" | "ar"
    );

    if (!emailResult.success) {
      console.error(`❌ Failed to send password reset email to ${user.email}: ${emailResult.error}`);
    }

    console.log(`✅ Password reset email sent to ${user.email}`);

    return res.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process password reset request",
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post("/reset-password", authRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      token: z.string(),
      newPassword: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(128)
        .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
        .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
        .regex(/(?=.*\d)/, "Password must contain at least one number")
        .regex(/(?=.*[@$!%*?&#])/, "Password must contain at least one special character (@$!%*?&#)"),
    });

    const { token, newPassword } = schema.parse(req.body);

    const success = await authService.resetPassword(token, newPassword);
    if (!success) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset token",
      });
    }

    console.log(`✅ Password reset successfully`);

    return res.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: error.errors,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Password reset failed",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (protected route)
 */
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await authService.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        jobTitle: user.jobTitle,
        role: user.role,
        organizationId: user.organizationId,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error: any) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user information",
    });
  }
});

/**
 * GET /api/auth/user
 * Alias for /api/auth/me for backwards compatibility
 */
router.get("/user", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await authService.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        jobTitle: user.jobTitle,
        role: user.role,
        organizationId: user.organizationId,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error: any) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user information",
    });
  }
});

export default router;
