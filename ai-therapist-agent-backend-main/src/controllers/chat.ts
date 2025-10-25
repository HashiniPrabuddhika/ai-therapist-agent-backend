import { Request, Response } from "express";
import { ChatSession, IChatSession } from "../models/ChatSession";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { inngest } from "../inngest/client";
import { User } from "../models/User";
import { InngestSessionResponse, InngestEvent } from "../types/inngest";
import { Types } from "mongoose";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || "AIzaSyBTC82xk2qIdBZjzMptkHEytAFq9VngJ3M"
);

// ✅ Create a new chat session
export const createChatSession = async (req: Request, res: Response) => {
  try {
    // ✅ FIX: Check if req.user exists
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = new Types.ObjectId(req.user.id);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const sessionId = uuidv4();

    const session = new ChatSession({
      sessionId,
      userId,
      startTime: new Date(),
      status: "active",
      messages: [],
    });

    await session.save();

    res.status(201).json({
      message: "Chat session created successfully",
      sessionId: session.sessionId,
    });
  } catch (error) {
    logger.error("Error creating chat session:", error);
    res.status(500).json({
      message: "Error creating chat session",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ✅ Send a message in the chat session
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    // ✅ FIX: Check if req.user exists
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = new Types.ObjectId(req.user.id);

    logger.info("Processing message:", { sessionId, message });

    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      logger.warn("Session not found:", { sessionId });
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.userId.toString() !== userId.toString()) {
      logger.warn("Unauthorized access attempt:", { sessionId, userId });
      return res.status(403).json({ message: "Unauthorized" });
    }

    const event: InngestEvent = {
      name: "therapy/session.message",
      data: {
        message,
        history: session.messages,
        memory: {
          userProfile: {
            emotionalState: [],
            riskLevel: 0,
            preferences: {},
          },
          sessionContext: {
            conversationThemes: [],
            currentTechnique: null,
          },
        },
        goals: [],
        systemPrompt: `You are an AI therapist assistant. Your role is to:
        1. Provide empathetic and supportive responses
        2. Use evidence-based therapeutic techniques
        3. Maintain professional boundaries
        4. Monitor for risk factors
        5. Guide users toward their therapeutic goals`,
      },
    };

    logger.info("Sending message to Inngest:", { event });
    await inngest.send(event);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const analysisPrompt = `Analyze this therapy message and provide insights. Return ONLY a valid JSON object with no markdown formatting or additional text.
    Message: ${message}
    Context: ${JSON.stringify({
      memory: event.data.memory,
      goals: event.data.goals,
    })}
    
    Required JSON structure:
    {
      "emotionalState": "string",
      "themes": ["string"],
      "riskLevel": number,
      "recommendedApproach": "string",
      "progressIndicators": ["string"]
    }`;

    const analysisResult = await model.generateContent(analysisPrompt);
    const analysisText = analysisResult.response.text().trim();
    const cleanAnalysisText = analysisText.replace(/```json\n|\n```/g, "").trim();
    const analysis = JSON.parse(cleanAnalysisText);

    logger.info("Message analysis:", analysis);

    const responsePrompt = `${event.data.systemPrompt}
    
    Based on the following context, generate a therapeutic response:
    Message: ${message}
    Analysis: ${JSON.stringify(analysis)}
    Memory: ${JSON.stringify(event.data.memory)}
    Goals: ${JSON.stringify(event.data.goals)}
    
    Provide a response that:
    1. Addresses the immediate emotional needs
    2. Uses appropriate therapeutic techniques
    3. Shows empathy and understanding
    4. Maintains professional boundaries
    5. Considers safety and well-being`;

    const responseResult = await model.generateContent(responsePrompt);
    const response = responseResult.response.text().trim();

    logger.info("Generated response:", response);

    session.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    session.messages.push({
      role: "assistant",
      content: response,
      timestamp: new Date(),
      metadata: {
        analysis,
        progress: {
          emotionalState: analysis.emotionalState,
          riskLevel: analysis.riskLevel,
        },
      },
    });

    await session.save();
    logger.info("Session updated successfully:", { sessionId });

    res.json({
      response,
      message: response,
      analysis,
      metadata: {
        progress: {
          emotionalState: analysis.emotionalState,
          riskLevel: analysis.riskLevel,
        },
      },
    });
  } catch (error) {
    logger.error("Error in sendMessage:", error);
    res.status(500).json({
      message: "Error processing message",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

};

// ✅ Get chat session history
export const getSessionHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // ✅ FIX: Check if req.user exists
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = new Types.ObjectId(req.user.id);

    const session = (await ChatSession.findById(sessionId).exec()) as IChatSession;
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json({
      messages: session.messages,
      startTime: session.startTime,
      status: session.status,
    });
  } catch (error) {
    logger.error("Error fetching session history:", error);
    res.status(500).json({ message: "Error fetching session history" });
  }
};

// ✅ Get a specific chat session
export const getChatSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    logger.info(`Getting chat session: ${sessionId}`);
    const chatSession = await ChatSession.findOne({ sessionId });
    if (!chatSession) {
      logger.warn(`Chat session not found: ${sessionId}`);
      return res.status(404).json({ error: "Chat session not found" });
    }
    logger.info(`Found chat session: ${sessionId}`);
    res.json(chatSession);
  } catch (error) {
    logger.error("Failed to get chat session:", error);
    res.status(500).json({ error: "Failed to get chat session" });
  }
};

// ✅ Get chat history for a session
export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // ✅ FIX: Check if req.user exists
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = new Types.ObjectId(req.user.id);

    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(session.messages);
  } catch (error) {
    logger.error("Error fetching chat history:", error);
    res.status(500).json({ message: "Error fetching chat history" });
  }
};

export const getAllUserSessions = async (req: Request, res: Response) => {
  try {
    console.log("\n📊 ========================================");
    console.log("📊 getAllUserSessions called");
    console.log("📊 Time:", new Date().toISOString());
    console.log("📊 ========================================");

    // ✅ Check if req.user exists and handle properly
    if (!req.user || !req.user.id) {
      console.error("❌ No user found in request");
      console.log("- req.user:", req.user);
      return res.status(401).json({
        error: "User not authenticated",
        message: "User ID not found in request"
      });
    }

    const userId = req.user.id;

    console.log(`- User ID: ${userId}`);
    console.log(`- User email: ${req.user.email}`);
    console.log(`- User name: ${req.user.name}`);

    // Query database
    console.log("- Querying database for sessions...");
    const sessions = await ChatSession.find({ userId })
      .sort({ startTime: -1 })
      .select('sessionId startTime status messages')
      .lean();

    console.log(`✅ Found ${sessions.length} sessions for user ${userId}`);

    // Format sessions
    const formattedSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      createdAt: session.startTime,
      updatedAt: session.messages.length > 0
        ? session.messages[session.messages.length - 1].timestamp
        : session.startTime,
      messages: session.messages,
      status: session.status,
    }));

    console.log("- Formatted sessions:", formattedSessions.length);
    console.log("📊 ========================================\n");

    res.json(formattedSessions);
  } catch (error) {
    console.error("\n❌ ========================================");
    console.error("❌ Error in getAllUserSessions");
    console.error("❌ Error:", error);
    console.error("❌ Stack:", error instanceof Error ? error.stack : "No stack");
    console.error("❌ ========================================\n");

    res.status(500).json({
      error: "Failed to fetch chat sessions",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};