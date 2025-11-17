import type { Request, Response, NextFunction } from "express";
import { authService } from "../services/authService";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  organizationId?: string;
}

/**
 * Middleware to verify JWT access token
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    console.log('[Auth] Request to:', req.method, req.path);
    console.log('[Auth] Authorization header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[Auth] No valid authorization header found');
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    console.log('[Auth] Token extracted:', token.substring(0, 20) + '...');

    // Verify token
    const payload = authService.verifyAccessToken(token);
    console.log('[Auth] Token verified for user:', payload.userId);

    // Attach user info to request
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    req.organizationId = payload.organizationId;

    next();
  } catch (error: any) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/**
 * Middleware to verify email is verified
 */
export const requireVerifiedEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await authService.getUserById(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email verification required",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    next();
  } catch (error: any) {
    console.error("Email verification check error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Optional auth middleware (doesn't fail if no token)
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = authService.verifyAccessToken(token);

      req.userId = payload.userId;
      req.userEmail = payload.email;
      req.userRole = payload.role;
      req.organizationId = payload.organizationId;
    }
    next();
  } catch (error) {
    // Silently continue without auth
    next();
  }
};
