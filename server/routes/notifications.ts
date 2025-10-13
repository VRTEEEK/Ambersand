import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/authMiddleware";
import { insertNotificationSchema } from "../../shared/schema";

const router = Router();

// Test endpoint to debug authentication (no auth required)
router.get("/test", (req: any, res) => {
  console.log('🔍 Notifications test route debug:');
  console.log('  - req.requireAuth():', req.requireAuth?.());
  console.log('  - req.user:', req.user);
  console.log('  - req.user?.id:', req.user?.id);
  res.json({ 
    message: "Test endpoint reached", 
    requireAuth: req.requireAuth?.(),
    userId: req.user?.id,
    userClaims: req.user?.claims 
  });
});

// GET /api/notifications - Get user's notifications
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.user?.organizationId || 'default';

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notifications = await storage.getNotifications(userId, organizationId);
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get("/unread-count", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.user?.organizationId || 'default';

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const count = await storage.getUnreadNotificationCount(userId, organizationId);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch("/:id/read", requireAuth, async (req: any, res) => {
  try {
    const notificationId = Number(req.params.id);
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (isNaN(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    await storage.markNotificationAsRead(notificationId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch("/mark-all-read", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await storage.markAllNotificationsAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/notifications - Create a new notification (internal use)
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId || 'default';
    
    const notificationData = insertNotificationSchema.parse({
      ...req.body,
      organizationId
    });

    const notification = await storage.createNotification(notificationData);
    res.json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;