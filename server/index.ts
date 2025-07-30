import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAdminNotification } from "./routes/admin-notification";
import { emailService } from "./services/emailService";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/send-admin-notification", handleAdminNotification);

  // Email service endpoints
  app.get("/api/email/status", async (_req, res) => {
    const isConnected = await emailService.verifyConnection();
    res.json({
      emailServiceConfigured: isConnected,
      status: isConnected ? 'connected' : 'not_configured',
      message: isConnected ? 'Email service is ready' : 'Email service not configured or connection failed'
    });
  });

  app.post("/api/email/test", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address required' });
    }

    const result = await emailService.sendTestEmail(email);
    res.json(result);
  });

  return app;
}
