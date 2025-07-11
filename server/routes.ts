import type { Express } from "express";
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
      const user = await storage.getUser(userId);
      
      const projectData = insertProjectSchema.parse({
        ...req.body,
        ownerId: userId,
        organizationId: user?.organizationId,
      });
      
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put('/api/projects/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projectData = insertProjectSchema.partial().parse(req.body);
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
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const taskData = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(id, taskData);
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
      const evidence = await storage.getEvidence(projectId, taskId);
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

      const evidenceData = insertEvidenceSchema.parse({
        title: req.body.title,
        titleAr: req.body.titleAr,
        description: req.body.description,
        descriptionAr: req.body.descriptionAr,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: req.file.path,
        taskId: req.body.taskId ? parseInt(req.body.taskId) : undefined,
        projectId: req.body.projectId ? parseInt(req.body.projectId) : undefined,
        eccControlId: req.body.eccControlId ? parseInt(req.body.eccControlId) : undefined,
        uploadedById: req.user.claims.sub,
      });
      
      const evidence = await storage.createEvidence(evidenceData);
      res.status(201).json(evidence);
    } catch (error) {
      console.error("Error uploading evidence:", error);
      res.status(500).json({ message: "Failed to upload evidence" });
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

  const httpServer = createServer(app);
  return httpServer;
}
