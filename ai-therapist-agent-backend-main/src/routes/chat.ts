import express from "express";
import {
  createChatSession,
  getChatSession,
  sendMessage,
  getChatHistory,
  getAllUserSessions,
} from "../controllers/chat";
import { auth } from "../middleware/auth";

const router = express.Router();

console.log("🔧 Setting up chat routes...");

// ✅ Apply auth middleware to all routes
router.use(auth);
console.log("  - Auth middleware applied to all chat routes");

// ✅ CRITICAL: Specific routes MUST come before parameterized routes
// The order matters! /sessions must be before /:sessionId

// GET /chat/sessions - Get all sessions
router.get("/sessions", (req, res, next) => {
  console.log("📊 Route matched: GET /chat/sessions");
  getAllUserSessions(req, res);
});
console.log("  ✅ GET /sessions registered");

// POST /chat/sessions - Create new session
router.post("/sessions", (req, res, next) => {
  console.log("📝 Route matched: POST /chat/sessions");
  createChatSession(req, res);
});
console.log("  ✅ POST /sessions registered");

// GET /chat/sessions/:sessionId - Get single session
router.get("/sessions/:sessionId", (req, res, next) => {
  console.log("📄 Route matched: GET /chat/sessions/:sessionId");
  getChatSession(req, res);
});
console.log("  ✅ GET /sessions/:sessionId registered");

// POST /chat/sessions/:sessionId/messages - Send message
router.post("/sessions/:sessionId/messages", (req, res, next) => {
  console.log("💬 Route matched: POST /chat/sessions/:sessionId/messages");
  sendMessage(req, res);
});
console.log("  ✅ POST /sessions/:sessionId/messages registered");

// GET /chat/sessions/:sessionId/history - Get history
router.get("/sessions/:sessionId/history", (req, res, next) => {
  console.log("📜 Route matched: GET /chat/sessions/:sessionId/history");
  getChatHistory(req, res);
});
console.log("  ✅ GET /sessions/:sessionId/history registered");

console.log("✅ Chat routes setup complete");

export default router;