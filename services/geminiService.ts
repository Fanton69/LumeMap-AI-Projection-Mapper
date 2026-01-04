
import { GoogleGenAI, Type } from "@google/genai";

/**
 * LumeMap AI Service
 * This service handles communication with Gemini to generate 
 * geometric projection mapping data based on user descriptions.
 */

const getApiKey = () => {
  try {
    // Rely on the environment variable provided by the platform
    return process.env.API_KEY || "";
  } catch (e) {
    return "";
  }
};

export const generateMappingAssistant = async (prompt: string) => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure the environment is configured correctly.");
  }

  // Initialize a new instance per call as per instructions to ensure up-to-date keys
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Design a projection mapping layout based on this request: "${prompt}"`,
    config: {
      systemInstruction: `You are a professional projection mapping designer. 
      Convert the user's creative request into a valid JSON set of geometric shapes.
      
      RULES:
      1. All coordinates (x, y) must be between 0.0 and 1.0 (representing screen percentages).
      2. Shapes should be logical (e.g., quads should have 4 points, circles should have multiple points forming a ring).
      3. Colors must be hex strings.
      4. Effects must be one of: 'none', 'strobe', 'breathe', 'rainbow'.
      5. Layouts should be aesthetically pleasing and centered.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Descriptive name of the surface" },
                points: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER }
                    },
                    required: ["x", "y"]
                  },
                  description: "Corner points of the shape"
                },
                style: {
                  type: Type.OBJECT,
                  properties: {
                    color: { type: Type.STRING, description: "Hex color code" },
                    effect: { type: Type.STRING, description: "none, strobe, breathe, or rainbow" },
                    effectSpeed: { type: Type.NUMBER, description: "1 to 10" }
                  },
                  required: ["color", "effect", "effectSpeed"]
                }
              },
              required: ["name", "points", "style"]
            }
          },
          explanation: { type: Type.STRING, description: "Brief explanation of the design choices" }
        },
        required: ["shapes"]
      }
    }
  });

  try {
    const result = JSON.parse(response.text.trim());
    return result;
  } catch (e) {
    console.error("Gemini Response Parsing Error:", e);
    throw new Error("The AI generated a layout that LumeMap couldn't parse. Try a simpler prompt.");
  }
};
