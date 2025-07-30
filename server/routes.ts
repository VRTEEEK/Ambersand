import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertProjectSchema,
  insertTaskSchema,
  insertEvidenceSchema,
  insertComplianceAssessmentSchema,
  insertControlAssessmentSchema,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { emailService } from "./emailService";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User Management routes
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      // Only admins can view all users
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const users = await storage.getAllUsers(currentUser.organizationId || undefined);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      // Only admins can create users
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { id, email, firstName, lastName, role, organizationId } = req.body;
      
      if (!id || !email || !role) {
        return res.status(400).json({ message: "ID, email, and role are required" });
      }

      const newUser = await storage.createUser({
        id,
        email,
        firstName,
        lastName,
        role,
        organizationId: organizationId || currentUser.organizationId,
      });

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch('/api/users/:userId/role', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      // Only admins can update user roles
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !['admin', 'manager', 'viewer'].includes(role)) {
        return res.status(400).json({ message: "Valid role is required (admin, manager, viewer)" });
      }

      const updatedUser = await storage.updateUserRole(userId, role);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.patch('/api/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      // Only admins can update user details
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { userId } = req.params;
      const updates = req.body;

      const updatedUser = await storage.updateUser(userId, updates);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Profile picture upload route
  app.post('/api/users/:userId/profile-picture', isAuthenticated, upload.single('profilePicture'), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      // Only admins can update user profile pictures
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { userId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Generate a unique filename
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `profile_${userId}_${Date.now()}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);
      
      // Move the file to the final location
      fs.renameSync(req.file.path, filePath);
      
      // Create URL for the uploaded file
      const profileImageUrl = `/uploads/${fileName}`;
      
      // Update user with new profile image URL
      const updatedUser = await storage.updateUser(userId, { profileImageUrl });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

  app.delete('/api/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      // Only admins can delete users
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { userId } = req.params;
      
      // Prevent self-deletion
      if (userId === currentUser.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const metrics = await storage.getDashboardMetrics(user?.organizationId || undefined);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Projects routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const projects = await storage.getProjects(user?.organizationId || undefined);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Creating project for user:", userId);
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      const user = await storage.getUser(userId);
      console.log("User found:", user ? "yes" : "no");
      
      // Extract controlIds from the request body
      const { controlIds, ...projectBody } = req.body;
      console.log("Extracted controlIds:", controlIds);
      console.log("Project body:", projectBody);
      
      const projectData = insertProjectSchema.parse({
        ...projectBody,
        organizationId: user?.organizationId,
      });
      console.log("Parsed project data:", projectData);
      
      const project = await storage.createProject(projectData);
      console.log("Project created with ID:", project.id);
      
      // Add controls to the project if provided
      if (controlIds && Array.isArray(controlIds) && controlIds.length > 0) {
        console.log("Adding", controlIds.length, "controls to project");
        await storage.addControlsToProject(project.id, controlIds);
        console.log("Controls added successfully");
      }
      
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack available');
      res.status(500).json({ 
        message: "Failed to create project",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.put('/api/projects/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projectData = req.body;
      const project = await storage.updateProject(id, projectData);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete('/api/projects/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project Controls routes
  app.get('/api/projects/:id/controls', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const controls = await storage.getProjectControls(projectId);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching project controls:", error);
      res.status(500).json({ message: "Failed to fetch project controls" });
    }
  });

  app.post('/api/projects/:id/controls', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }

      await storage.addControlsToProject(projectId, controlIds);
      res.status(201).json({ message: "Controls added to project successfully" });
    } catch (error) {
      console.error("Error adding controls to project:", error);
      res.status(500).json({ message: "Failed to add controls to project" });
    }
  });

  app.delete('/api/projects/:projectId/controls/:controlId', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const controlId = parseInt(req.params.controlId);
      
      await storage.removeControlFromProject(projectId, controlId);
      res.json({ message: "Control removed from project successfully" });
    } catch (error) {
      console.error("Error removing control from project:", error);
      res.status(500).json({ message: "Failed to remove control from project" });
    }
  });

  // Tasks routes
  app.get('/api/tasks', isAuthenticated, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const assigneeId = req.query.assigneeId as string | undefined;
      const tasks = await storage.getTasks(projectId, assigneeId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const taskData = insertTaskSchema.parse({
        ...req.body,
        createdById: req.user.claims.sub,
      });
      
      const task = await storage.createTask(taskData);
      
      // Send email notification if task is assigned to someone (including self)
      console.log('📧 Email check:', { 
        taskAssigneeId: task.assigneeId, 
        currentUserId: req.user.claims.sub,
        shouldSendEmail: !!task.assigneeId
      });
      
      if (task.assigneeId) {
        console.log('📧 Attempting to send task assignment email...');
        try {
          const assignedUser = await storage.getUser(task.assigneeId);
          const project = task.projectId ? await storage.getProject(task.projectId) : null;
          
          if (assignedUser && assignedUser.email) {
            const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set';
            const projectName = project?.name || 'Untitled Project';
            const template = emailService.templates.taskAssignment(
              assignedUser.firstName || assignedUser.name || 'User',
              task.title,
              dueDate,
              projectName,
              (assignedUser.language as 'en' | 'ar') || 'en',
              task.id
            );
            
            await emailService.sendEmail({
              to: assignedUser.email,
              subject: template.subject,
              html: template.html,
            });
            
            console.log(`✅ Task assignment email sent successfully to ${assignedUser.email}`);
          } else {
            console.log('❌ No email sent: Missing assigned user or email address');
          }
        } catch (emailError) {
          console.error('❌ Failed to send task assignment email:', emailError);
          // Don't fail the task creation if email fails
        }
      } else {
        console.log('🔄 No email sent: Task not assigned to any user');
      }
      
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      console.log('PUT /api/tasks/:id called with:', { id: req.params.id, body: req.body });
      const id = parseInt(req.params.id);
      const taskData = insertTaskSchema.partial().parse(req.body);
      console.log('Parsed task data:', taskData);
      
      // Get the old task for status comparison
      const oldTask = await storage.getTask(id);
      const task = await storage.updateTask(id, taskData);
      console.log('Task updated successfully:', task);
      
      // Send email notifications for status changes and new assignments
      try {
        // Check for status update
        if (oldTask && taskData.status && oldTask.status !== taskData.status && task.assigneeId) {
          const assignedUser = await storage.getUser(task.assigneeId);
          if (assignedUser && assignedUser.email) {
            const template = emailService.templates.statusUpdate(
              assignedUser.firstName || assignedUser.name || 'User',
              task.title,
              oldTask.status,
              taskData.status,
              (assignedUser.language as 'en' | 'ar') || 'en'
            );
            
            await emailService.sendEmail({
              to: assignedUser.email,
              subject: template.subject,
              html: template.html,
            });
            
            console.log(`Task status update email sent to ${assignedUser.email}`);
          }
        }
        
        // Check for new assignment (including self-assignment)
        console.log('📧 Assignment check:', { 
          newAssigneeId: taskData.assigneeId, 
          oldAssigneeId: oldTask?.assigneeId,
          currentUserId: req.user.claims.sub,
          isNewAssignment: taskData.assigneeId && oldTask?.assigneeId !== taskData.assigneeId
        });
        
        if (taskData.assigneeId && oldTask?.assigneeId !== taskData.assigneeId) {
          console.log('📧 Attempting to send task reassignment email...');
          const assignedUser = await storage.getUser(taskData.assigneeId);
          const project = task.projectId ? await storage.getProject(task.projectId) : null;
          
          if (assignedUser && assignedUser.email) {
            const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set';
            const projectName = project?.name || 'Untitled Project';
            const template = emailService.templates.taskAssignment(
              assignedUser.firstName || assignedUser.name || 'User',
              task.title,
              dueDate,
              projectName,
              (assignedUser.language as 'en' | 'ar') || 'en',
              task.id
            );
            
            await emailService.sendEmail({
              to: assignedUser.email,
              subject: template.subject,
              html: template.html,
            });
            
            console.log(`✅ Task reassignment email sent successfully to ${assignedUser.email}`);
          } else {
            console.log('❌ No reassignment email sent: Missing assigned user or email address');
          }
        }
      } catch (emailError) {
        console.error('Failed to send task update email:', emailError);
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTask(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Task Controls routes
  app.get('/api/tasks/:id/controls', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const controls = await storage.getTaskControls(taskId);
      console.log('📋 Task controls for task', taskId, ':', JSON.stringify(controls, null, 2));
      res.json(controls);
    } catch (error) {
      console.error("Error fetching task controls:", error);
      res.status(500).json({ message: "Failed to fetch task controls" });
    }
  });

  // Get all task controls for displaying badges
  app.get('/api/tasks/controls/all', isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasks();
      const taskControlsMap: Record<number, any[]> = {};
      
      for (const task of tasks) {
        const controls = await storage.getTaskControls(task.id);
        taskControlsMap[task.id] = controls;
      }
      
      res.json(taskControlsMap);
    } catch (error) {
      console.error("Error fetching all task controls:", error);
      res.status(500).json({ message: "Failed to fetch all task controls" });
    }
  });

  // Get evidence for a specific task
  app.get('/api/evidence/task/:taskId', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const evidence = await storage.getEvidenceByTaskId(taskId);
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching task evidence:", error);
      res.status(500).json({ message: "Failed to fetch task evidence" });
    }
  });

  app.post('/api/tasks/:id/controls', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }
      
      await storage.addControlsToTask(taskId, controlIds);
      res.status(201).json({ message: "Controls added to task successfully" });
    } catch (error) {
      console.error("Error adding controls to task:", error);
      res.status(500).json({ message: "Failed to add controls to task" });
    }
  });

  app.delete('/api/tasks/:id/controls', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }
      
      await storage.removeControlsFromTask(taskId, controlIds);
      res.json({ message: "Controls removed from task successfully" });
    } catch (error) {
      console.error("Error removing controls from task:", error);
      res.status(500).json({ message: "Failed to remove controls from task" });
    }
  });

  // ECC Controls routes
  app.get('/api/ecc-controls', isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const controls = await storage.getEccControls(search);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching ECC controls:", error);
      res.status(500).json({ message: "Failed to fetch ECC controls" });
    }
  });

  app.get('/api/ecc-controls/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const control = await storage.getEccControl(id);
      if (!control) {
        return res.status(404).json({ message: "ECC control not found" });
      }
      res.json(control);
    } catch (error) {
      console.error("Error fetching ECC control:", error);
      res.status(500).json({ message: "Failed to fetch ECC control" });
    }
  });

  // Evidence routes
  app.get('/api/evidence', isAuthenticated, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
      console.log('Evidence query - projectId:', projectId, 'taskId:', taskId);
      const evidence = await storage.getEvidence(projectId);
      console.log('Evidence query result:', evidence.length, 'items found');
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  app.post('/api/evidence', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // If evidence is uploaded to a task, get the first control associated with that task
      let controlId = req.body.eccControlId ? parseInt(req.body.eccControlId) : undefined;
      const taskId = req.body.taskId ? parseInt(req.body.taskId) : undefined;
      
      if (taskId && !controlId) {
        try {
          const taskControls = await storage.getTaskControls(taskId);
          if (taskControls.length > 0) {
            controlId = taskControls[0].eccControl.id;
            console.log(`🔗 Auto-assigning control ${controlId} to evidence from task ${taskId}`);
          }
        } catch (error) {
          console.log('⚠️ Could not retrieve task controls:', error);
        }
      }

      const evidenceData = insertEvidenceSchema.parse({
        title: req.body.title,
        titleAr: req.body.titleAr,
        description: req.body.description,
        descriptionAr: req.body.descriptionAr,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: req.file.path,
        taskId: taskId,
        projectId: req.body.projectId ? parseInt(req.body.projectId) : undefined,
        eccControlId: controlId,
        uploadedById: req.user.claims.sub,
      });
      
      const evidence = await storage.createEvidence(evidenceData);
      res.status(201).json(evidence);
    } catch (error) {
      console.error("Error uploading evidence:", error);
      res.status(500).json({ message: "Failed to upload evidence" });
    }
  });

  app.get('/api/evidence/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const evidence = await storage.getEvidenceById(id);
      if (!evidence) {
        return res.status(404).json({ message: "Evidence not found" });
      }
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  app.put('/api/evidence/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const evidence = await storage.updateEvidence(id, updates);
      res.json(evidence);
    } catch (error) {
      console.error("Error updating evidence:", error);
      res.status(500).json({ message: "Failed to update evidence" });
    }
  });

  app.delete('/api/evidence/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEvidence(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting evidence:", error);
      res.status(500).json({ message: "Failed to delete evidence" });
    }
  });

  // Evidence Versions routes
  app.get('/api/evidence/:id/versions', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const versions = await storage.getEvidenceVersions(evidenceId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching evidence versions:", error);
      res.status(500).json({ message: "Failed to fetch evidence versions" });
    }
  });

  app.post('/api/evidence/:id/versions', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const evidenceId = parseInt(req.params.id);
      const versionData = {
        evidenceId,
        version: req.body.version,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: req.file.path,
        uploadedById: req.user.claims.sub,
      };

      const version = await storage.createEvidenceVersion(versionData);
      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating evidence version:", error);
      res.status(500).json({ message: "Failed to create evidence version" });
    }
  });

  // Evidence Comments routes
  app.get('/api/evidence/:id/comments', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const comments = await storage.getEvidenceComments(evidenceId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching evidence comments:", error);
      res.status(500).json({ message: "Failed to fetch evidence comments" });
    }
  });

  // Evidence linked to specific control
  app.get('/api/evidence/control/:controlId', isAuthenticated, async (req, res) => {
    try {
      const controlId = parseInt(req.params.controlId);
      
      // Get evidence directly linked to the control via ecc_control_id
      const evidenceList = await storage.getEvidence();
      const directlyLinkedEvidence = evidenceList.filter(evidence => evidence.eccControlId === controlId);
      
      // Also check for evidence linked through many-to-many relationship
      const linkedEvidence = [...directlyLinkedEvidence];
      for (const evidence of evidenceList) {
        // Skip if already included from direct relationship
        if (evidence.eccControlId === controlId) continue;
        
        try {
          const evidenceControls = await storage.getEvidenceControls(evidence.id);
          if (evidenceControls.some(ec => ec.eccControl.id === controlId)) {
            linkedEvidence.push(evidence);
          }
        } catch (error) {
          // Continue if getEvidenceControls fails for this evidence
          console.log(`Could not get controls for evidence ${evidence.id}:`, error.message);
        }
      }
      
      console.log(`Found ${linkedEvidence.length} evidence items linked to control ${controlId}`);
      res.json(linkedEvidence);
    } catch (error) {
      console.error("Error fetching evidence for control:", error);
      res.status(500).json({ message: "Failed to fetch evidence for control" });
    }
  });

  // Evidence versions for a specific task
  app.get('/api/evidence/versions/:taskId', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      // This would fetch versions for all evidence related to the task
      const versions = await storage.getEvidenceVersions(taskId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching evidence versions for task:", error);
      res.status(500).json({ message: "Failed to fetch evidence versions" });
    }
  });

  // Evidence comments for a specific task
  app.get('/api/evidence/comments/:taskId', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      // This would fetch comments for all evidence related to the task
      const comments = await storage.getEvidenceComments(taskId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching evidence comments for task:", error);
      res.status(500).json({ message: "Failed to fetch evidence comments" });
    }
  });

  // Create evidence comment
  app.post('/api/evidence/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { comment, isSystemComment, commentType } = req.body;
      
      if (!comment || comment.trim() === '') {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      const commentData = {
        evidenceId,
        userId: req.user.claims.sub,
        comment: comment.trim(),
        isSystemComment: isSystemComment || false,
        commentType: commentType || 'user',
      };
      
      const newComment = await storage.createEvidenceComment(commentData);
      res.status(201).json(newComment);
    } catch (error) {
      console.error("Error creating evidence comment:", error);
      res.status(500).json({ message: "Failed to create evidence comment" });
    }
  });

  // Evidence Controls routes
  app.get('/api/evidence/:id/controls', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const controls = await storage.getEvidenceControls(evidenceId);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching evidence controls:", error);
      res.status(500).json({ message: "Failed to fetch evidence controls" });
    }
  });

  // Get evidence linked to a specific control
  app.get('/api/controls/:controlId/evidence', isAuthenticated, async (req, res) => {
    try {
      const controlId = parseInt(req.params.controlId);
      const evidenceList = await storage.getControlLinkedEvidence(controlId);
      res.json(evidenceList);
    } catch (error) {
      console.error("Error fetching control evidence:", error);
      res.status(500).json({ message: "Failed to fetch control evidence" });
    }
  });

  app.post('/api/evidence/:id/controls', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }
      
      await storage.addControlsToEvidence(evidenceId, controlIds);
      res.status(201).json({ message: "Controls added to evidence successfully" });
    } catch (error) {
      console.error("Error adding controls to evidence:", error);
      res.status(500).json({ message: "Failed to add controls to evidence" });
    }
  });

  app.delete('/api/evidence/:id/controls', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }
      
      await storage.removeControlsFromEvidence(evidenceId, controlIds);
      res.json({ message: "Controls removed from evidence successfully" });
    } catch (error) {
      console.error("Error removing controls from evidence:", error);
      res.status(500).json({ message: "Failed to remove controls from evidence" });
    }
  });

  // Evidence Tasks routes
  app.get('/api/evidence/:id/tasks', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const tasks = await storage.getEvidenceTasks(evidenceId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching evidence tasks:", error);
      res.status(500).json({ message: "Failed to fetch evidence tasks" });
    }
  });

  app.post('/api/evidence/:id/tasks', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { taskIds } = req.body;
      
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ message: "taskIds must be an array" });
      }
      
      await storage.addTasksToEvidence(evidenceId, taskIds);
      res.status(201).json({ message: "Tasks added to evidence successfully" });
    } catch (error) {
      console.error("Error adding tasks to evidence:", error);
      res.status(500).json({ message: "Failed to add tasks to evidence" });
    }
  });

  app.delete('/api/evidence/:id/tasks', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { taskIds } = req.body;
      
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ message: "taskIds must be an array" });
      }
      
      await storage.removeTasksFromEvidence(evidenceId, taskIds);
      res.json({ message: "Tasks removed from evidence successfully" });
    } catch (error) {
      console.error("Error removing tasks from evidence:", error);
      res.status(500).json({ message: "Failed to remove tasks from evidence" });
    }
  });

  // Custom Regulations routes
  app.get('/api/custom-regulations', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const regulations = await storage.getCustomRegulations(user?.organizationId || undefined);
      res.json(regulations);
    } catch (error) {
      console.error("Error fetching custom regulations:", error);
      res.status(500).json({ message: "Failed to fetch custom regulations" });
    }
  });

  app.get('/api/custom-regulations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const regulation = await storage.getCustomRegulation(id);
      if (!regulation) {
        return res.status(404).json({ message: "Custom regulation not found" });
      }
      res.json(regulation);
    } catch (error) {
      console.error("Error fetching custom regulation:", error);
      res.status(500).json({ message: "Failed to fetch custom regulation" });
    }
  });

  app.post('/api/custom-regulations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const regulationData = {
        ...req.body,
        organizationId: user?.organizationId || 'default',
        createdById: userId,
      };
      
      const regulation = await storage.createCustomRegulation(regulationData);
      res.status(201).json(regulation);
    } catch (error) {
      console.error("Error creating custom regulation:", error);
      res.status(500).json({ message: "Failed to create custom regulation" });
    }
  });

  app.put('/api/custom-regulations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const regulation = await storage.updateCustomRegulation(id, req.body);
      res.json(regulation);
    } catch (error) {
      console.error("Error updating custom regulation:", error);
      res.status(500).json({ message: "Failed to update custom regulation" });
    }
  });

  app.delete('/api/custom-regulations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomRegulation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom regulation:", error);
      res.status(500).json({ message: "Failed to delete custom regulation" });
    }
  });

  // Custom Controls routes
  app.get('/api/custom-controls', isAuthenticated, async (req, res) => {
    try {
      const regulationId = req.query.regulationId ? parseInt(req.query.regulationId as string) : undefined;
      const controls = await storage.getCustomControls(regulationId);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching custom controls:", error);
      res.status(500).json({ message: "Failed to fetch custom controls" });
    }
  });

  app.post('/api/custom-controls', isAuthenticated, async (req, res) => {
    try {
      const control = await storage.createCustomControl(req.body);
      res.status(201).json(control);
    } catch (error) {
      console.error("Error creating custom control:", error);
      res.status(500).json({ message: "Failed to create custom control" });
    }
  });

  app.put('/api/custom-controls/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const control = await storage.updateCustomControl(id, req.body);
      res.json(control);
    } catch (error) {
      console.error("Error updating custom control:", error);
      res.status(500).json({ message: "Failed to update custom control" });
    }
  });

  app.delete('/api/custom-controls/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomControl(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom control:", error);
      res.status(500).json({ message: "Failed to delete custom control" });
    }
  });

  // Email testing endpoint
  app.post('/api/test-email', isAuthenticated, async (req: any, res) => {
    try {
      console.log('Test email request received:', req.body);
      const { to, type } = req.body;
      
      if (!to) {
        return res.status(400).json({ message: "Recipient email is required" });
      }

      if (!process.env.RESEND_API_KEY) {
        return res.status(500).json({ message: "Email service not configured. RESEND_API_KEY is missing." });
      }

      let template;
      switch (type) {
        case 'task-assignment':
          template = emailService.templates.taskAssignment(
            'Test User',
            'Sample Task Assignment',
            '2025-08-01',
            'Sample Project',
            'en',
            123 // Sample task ID for testing
          );
          break;
        case 'deadline-reminder':
          template = emailService.templates.deadlineReminder(
            'Test User',
            'Sample Task with Deadline',
            '2025-08-01',
            'en',
            456 // Sample task ID for testing
          );
          break;
        case 'status-update':
          template = emailService.templates.statusUpdate(
            'Test User',
            'Sample Task Status Change',
            'in-progress',
            'completed',
            'en',
            789 // Sample task ID for testing
          );
          break;
        default:
          return res.status(400).json({ message: "Invalid email type. Use: task-assignment, deadline-reminder, or status-update" });
      }

      console.log('Sending test email with template:', { to, subject: template.subject });
      await emailService.sendEmail({
        to,
        subject: template.subject,
        html: template.html,
      });

      res.json({ message: "Test email sent successfully", to, subject: template.subject });
    } catch (error) {
      console.error("Error sending test email:", error);
      const errorMessage = (error as Error)?.message || 'Unknown error';
      res.status(500).json({ 
        message: "Failed to send test email", 
        error: errorMessage,
        details: error
      });
    }
  });

  // Evidence upload endpoint
  app.post('/api/evidence/upload', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
    try {
      console.log('Evidence upload request received:', {
        body: req.body,
        filesCount: req.files?.length || 0,
        user: req.user?.claims?.sub
      });
      
      const taskId = parseInt(req.body.taskId);
      const projectId = parseInt(req.body.projectId);
      const controlId = req.body.controlId ? parseInt(req.body.controlId) : null;
      const comment = req.body.comment ? req.body.comment.trim() : null;
      const isNewVersion = req.body.isNewVersion === 'true';
      const parentEvidenceId = req.body.parentEvidenceId ? parseInt(req.body.parentEvidenceId) : null;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const evidenceRecords = [];
      for (const file of files) {
        // Check if this is a new version upload based on isNewVersion and parentEvidenceId
        if (isNewVersion && parentEvidenceId) {
          const parentEvidence = await storage.getEvidenceById(parentEvidenceId);
          if (!parentEvidence) {
            throw new Error(`Parent evidence with ID ${parentEvidenceId} not found`);
          }
          
          // Get all existing versions to determine the next version number
          const existingVersions = await storage.getEvidenceVersions(parentEvidenceId);
          const maxVersion = existingVersions.length > 0 
            ? Math.max(...existingVersions.map(v => parseFloat(v.version)))
            : parseFloat(parentEvidence.version);
          const nextVersion = `${Math.floor(maxVersion) + 1}.0`;
          
          // First, store the current version as a version record if it doesn't exist
          const currentVersionExists = existingVersions.some(v => v.version === parentEvidence.version);
          if (!currentVersionExists) {
            await storage.createEvidenceVersion({
              evidenceId: parentEvidenceId,
              version: parentEvidence.version,
              fileName: parentEvidence.fileName,
              fileSize: parentEvidence.fileSize,
              fileType: parentEvidence.fileType,
              filePath: parentEvidence.filePath,
              uploadedById: parentEvidence.uploadedById,
            });
          }
          
          // Create a new version record for the uploaded file
          const version = await storage.createEvidenceVersion({
            evidenceId: parentEvidenceId,
            version: nextVersion,
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype,
            filePath: file.path,
            uploadedById: req.user.claims.sub,
          });
          
          // Update the main evidence record to show the latest version
          const updatedEvidence = await storage.updateEvidence(parentEvidenceId, {
            version: nextVersion,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            fileType: file.mimetype,
          });
          
          // Add version note as system comment if provided
          if (comment) {
            const systemComment = `Uploaded version ${nextVersion}: ${comment}`;
            await storage.createEvidenceComment({
              evidenceId: parentEvidenceId,
              userId: req.user.claims.sub,
              comment: systemComment,
              isSystemComment: true,
              commentType: 'version_upload'
            });
          }
          
          evidenceRecords.push(updatedEvidence);
        } else {
          // Create new evidence record
          const evidenceData = {
            taskId: taskId || undefined,
            projectId: projectId || undefined,
            eccControlId: controlId || undefined,
            title: file.originalname,
            titleAr: file.originalname,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            fileType: file.mimetype,
            description: `Evidence file: ${file.originalname}`,
            descriptionAr: `ملف أدلة: ${file.originalname}`,
            uploadedById: req.user.claims.sub,
          };
          
          console.log('Creating evidence record:', evidenceData);
          const evidence = await storage.createEvidence(evidenceData);
          
          // Associate evidence with control if provided
          if (controlId) {
            await storage.addControlsToEvidence(evidence.id, [controlId]);
          }
          
          // Associate evidence with task if provided
          if (taskId) {
            await storage.addTasksToEvidence(evidence.id, [taskId]);
          }
          
          // Add comment if provided
          if (comment) {
            await storage.createEvidenceComment({
              evidenceId: evidence.id,
              userId: req.user.claims.sub,
              comment: comment,
            });
          }
          
          evidenceRecords.push(evidence);
        }
      }

      console.log('Evidence upload successful:', evidenceRecords.length, 'files');
      res.status(201).json({
        message: "Files uploaded successfully",
        evidence: evidenceRecords,
      });
    } catch (error) {
      console.error("Error uploading evidence:", error);
      res.status(500).json({ message: "Failed to upload evidence" });
    }
  });

  // Serve uploaded files
  app.get('/api/evidence/:id/download', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const evidence = await storage.getEvidence();
      const evidenceItem = evidence.find(e => e.id === id);
      
      if (!evidenceItem) {
        return res.status(404).json({ message: "Evidence not found" });
      }

      res.download(evidenceItem.filePath, evidenceItem.fileName);
    } catch (error) {
      console.error("Error downloading evidence:", error);
      res.status(500).json({ message: "Failed to download evidence" });
    }
  });

  // Serve uploaded files (profile pictures and evidence)
  app.use('/uploads', (req, res, next) => {
    // Add CORS headers for uploaded files
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  app.use('/uploads', express.static(uploadDir));

  const httpServer = createServer(app);
  return httpServer;
}
