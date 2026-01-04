
import { GoogleGenAI, Type } from "@google/genai";

// Use process.env.API_KEY directly in the named parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMappingAssistant = async (prompt: string) => {
  // Use gemini-3-pro-preview for complex reasoning and geometry generation.
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: `You are an expert projection mapping assistant. 
      Your goal is to help the user create shapes and layouts.
      When asked for shapes, return a JSON object containing an array of shapes.
      Each shape should have:
      - name: A descriptive name
      - points: An array of {x, y} objects where x and y are between 0 and 1 (percentage of canvas)
      - style: { color (hex), effect (one of: none, strobe, breathe, rainbow), effectSpeed (1-10) }
      
      Example valid response:
      {
        "shapes": [
          {
            "name": "Square Frame",
            "points": [{"x": 0.2, "y": 0.2}, {"x": 0.8, "y": 0.2}, {"x": 0.8, "y": 0.8}, {"x": 0.2, "y": 0.8}],
            "style": { "color": "#00ff00", "effect": "breathe", "effectSpeed": 5 }
          }
        ]
      }`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                points: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER }
                    }
                  }
                },
                style: {
                  type: Type.OBJECT,
                  properties: {
                    color: { type: Type.STRING },
                    effect: { type: Type.STRING },
                    effectSpeed: { type: Type.NUMBER }
                  }
                }
              }
            }
          },
          explanation: { type: Type.STRING }
        }
      }
    }
  });

  try {
    // Access response.text as a property, not a method.
    return JSON.parse(response.text.trim());
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return null;
  }
};
