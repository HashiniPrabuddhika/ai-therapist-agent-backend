import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User";
import { Types } from "mongoose";
import { JWT_SECRET } from "../config/jwt"; // ✅ Import from shared config

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        _id: Types.ObjectId;
        email: string;
        name: string;
      };
    }
  }
}

interface JWTPayload {
  userId: string;
  iat: number;
  exp: number;
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    console.log("🔐 Auth Middleware:");
    console.log("- Authorization header present:", !!authHeader);
    console.log("- Token extracted:", token ? "Yes" : "No");
    console.log("- JWT_SECRET (first 20 chars):", JWT_SECRET.substring(0, 20) + "...");

    if (!token) {
      console.log("❌ No token provided");
      return res.status(401).json({ 
        message: "Authentication required",
        error: "No token provided"
      });
    }

    console.log("- Token to verify (first 50 chars):", token.substring(0, 50) + "...");

    let decoded: JWTPayload;
    try {
      // ✅ Use shared JWT_SECRET from config
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      console.log("🔓 Token decoded successfully");
      console.log("- userId from token:", decoded.userId);
      console.log("- Token issued at:", new Date(decoded.iat * 1000).toISOString());
      console.log("- Token expires at:", new Date(decoded.exp * 1000).toISOString());
    } catch (jwtError) {
      console.error("❌ JWT verification failed:");
      console.error("- Error name:", jwtError instanceof Error ? jwtError.name : "Unknown");
      console.error("- Error message:", jwtError instanceof Error ? jwtError.message : "Unknown error");
      
      return res.status(401).json({ 
        message: "Invalid authentication token",
        error: jwtError instanceof Error ? jwtError.message : "JWT verification failed"
      });
    }

    const user = await User.findById(decoded.userId) as IUser | null;

    if (!user) {
      console.log("❌ User not found for ID:", decoded.userId);
      return res.status(401).json({ 
        message: "User not found",
        error: "User account no longer exists"
      });
    }

    console.log("✅ User authenticated successfully:", user.email);

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error);
    res.status(401).json({ 
      message: "Authentication failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};