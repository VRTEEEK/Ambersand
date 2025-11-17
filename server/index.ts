import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import crypto from "crypto";

const app = express();
// Trust proxy to fix rate limiter X-Forwarded-For warning
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set APP_URL for email links
process.env.APP_URL = process.env.APP_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(server: any, signal: string) {
  if (isShuttingDown || gracefulShutdownInProgress) return;
  isShuttingDown = true;
  gracefulShutdownInProgress = true;

  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Set a timeout for forced shutdown
  const forceTimeout = setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    // Stop accepting new requests and wait for existing connections to close
    await new Promise<void>((resolve, reject) => {
      server.close((err: any) => {
        if (err) {
          console.error('Error closing HTTP server:', err);
          reject(err);
        } else {
          console.log('HTTP server closed.');
          resolve();
        }
      });
    });

    // Close database connections
    try {
      const { pool } = await import("./db");
      await pool.end();
      console.log('Database pool closed.');
    } catch (error) {
      console.error('Error closing database pool:', error);
    }

    // Clear the timeout since we completed gracefully
    clearTimeout(forceTimeout);
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    clearTimeout(forceTimeout);
    process.exit(1);
  }
}

// Global variables for graceful shutdown
let serverInstance: any = null;
let gracefulShutdownInProgress = false;

// Add process-level error handlers with graceful shutdown
process.on('uncaughtException', async (error) => {
  console.error('UncaughtException:', error);
  if (serverInstance && !gracefulShutdownInProgress) {
    console.log('Application will be gracefully shut down...');
    await gracefulShutdown(serverInstance, 'uncaughtException');
  } else {
    console.log('No server instance or shutdown in progress, exiting immediately');
    process.exit(1);
  }
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (serverInstance && !gracefulShutdownInProgress) {
    console.log('Application will be gracefully shut down...');
    await gracefulShutdown(serverInstance, 'unhandledRejection');
  } else {
    console.log('No server instance or shutdown in progress, exiting immediately');
    process.exit(1);
  }
});

(async () => {
  // Check database connection health on startup
  try {
    const { checkDatabaseConnection } = await import("./db");
    const isHealthy = await checkDatabaseConnection();
    if (!isHealthy) {
      console.warn("Database connection check failed at startup, but continuing...");
    }
  } catch (error) {
    console.error("Database connection check error:", error);
  }

  // Initialize RBAC system on startup
  try {
    const { seedRBAC } = await import("./rbac-seed");
    await seedRBAC();
  } catch (error) {
    console.error("Failed to seed RBAC:", error);
  }

  const server = await registerRoutes(app);
  serverInstance = server; // Store server instance for graceful shutdown

  // IMPORTANT: Serve static files for uploads BEFORE setupVite
  // This prevents Vite's catch-all route from intercepting upload requests
  const path = await import("path");
  const uploadsDir = path.join(process.cwd(), 'uploads', 'profile-images');
  app.use('/uploads/profile-images', express.static(uploadsDir));
  log('Static file serving configured for /uploads/profile-images');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // Generate a correlation ID for error tracking
    const errorId = crypto.randomBytes(8).toString('hex');
    
    // Log full error details with correlation ID for debugging
    console.error(`[Error ${errorId}] Express error handler caught error:`, {
      error: err,
      stack: err.stack,
      url: _req.url,
      method: _req.method,
      userAgent: _req.get('User-Agent'),
      ip: _req.ip
    });

    // Return generic error message to client to avoid information disclosure
    let clientMessage;
    if (status >= 400 && status < 500) {
      // Client errors - safe to return specific message for validation errors
      clientMessage = err.message && err.isClientError ? err.message : "Bad Request";
    } else {
      // Server errors - return generic message only
      clientMessage = "Internal Server Error";
    }

    res.status(status).json({ 
      message: clientMessage,
      errorId: errorId // Include correlation ID for support purposes
    });
    // Don't throw the error here as it crashes the process
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Set up graceful shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));
})();
