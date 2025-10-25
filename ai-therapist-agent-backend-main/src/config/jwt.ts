export const JWT_SECRET = 
  process.env.JWT_SECRET || 
  "7c2e1a3b9c5df7a08e53b947db102e8a04ccdf36b5a89f9983d91c5424f7c9c9bcb1fa9c4c37e721c2c2c4f9b9f83b67";

// Log on import to verify it's loaded
console.log("🔑 JWT_SECRET loaded, first 20 chars:", JWT_SECRET.substring(0, 20));

export default JWT_SECRET;