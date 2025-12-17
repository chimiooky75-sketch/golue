import { GoogleGenAI, Type } from "@google/genai";
import { RiskAnalysis, MenuAnalysis, DestinationResult, RoutePlan } from "../types";

// Initialize Gemini Client
// CRITICAL: process.env.API_KEY is assumed to be available
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generate a structured route plan with transport estimates from text
 */
export const generateRoutePlan = async (text: string): Promise<RoutePlan> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `你是一个智能旅游行程规划师。请分析用户提供的旅游攻略文本，生成一份详细的路线规划。
      
      任务：
      1. 按顺序提取所有明确的地点。
      2. 估算在每个景点/地点的**建议停留时间**（例如：2小时、30分钟）。
      3. 规划相邻两个地点之间最合理的交通方式。
         - **优先查找地铁线路**：如果两地有地铁连接，请务必标注具体的地铁线路名称（如“地铁1号线”）。
         - 如果距离较近（<1.5km），推荐步行。
         - 否则推荐打车或公交。
      4. 给整个行程起一个吸引人的标题。
      
      攻略文本: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["FOOD", "SCENERY", "HOTEL", "OTHER"] },
                  estimatedStay: { type: Type.STRING }
                },
                required: ["id", "name", "description", "type"]
              }
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  from: { type: Type.INTEGER },
                  to: { type: Type.INTEGER },
                  transportMode: { type: Type.STRING, enum: ["WALK", "TAXI", "BUS", "SUBWAY"] },
                  duration: { type: Type.STRING },
                  distance: { type: Type.STRING },
                  details: { type: Type.STRING }
                },
                required: ["from", "to", "transportMode", "duration", "distance"]
              }
            }
          },
          required: ["title", "nodes", "edges"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as RoutePlan;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Route generation failed:", error);
    throw error;
  }
};

/**
 * Analyze text itinerary for travel scams
 */
export const analyzeItinerary = async (text: string): Promise<RiskAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `你是一位厦门旅游安全专家。请分析以下行程是否存在消费陷阱、宰客风险或不合理的安排，特别是关于海鲜市场、出租车推荐和茶叶骗局等方面。
      
      行程内容: "${text}"
      
      请返回中文（简体）的风险评估报告。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "风险指数 0 (安全) 到 100 (极度危险)" },
            summary: { type: Type.STRING, description: "分析摘要（中文）" },
            risks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  location: { type: Type.STRING, description: "地点名称" },
                  riskLevel: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"], description: "风险等级" },
                  reason: { type: Type.STRING, description: "风险原因（中文）" },
                  suggestion: { type: Type.STRING, description: "避雷建议（中文）" }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as RiskAnalysis;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

/**
 * Analyze menu image for pricing traps using OCR and reasoning
 */
export const analyzeMenuImage = async (base64Image: string): Promise<MenuAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: "请分析这张厦门海鲜菜单是否存在价格陷阱。寻找隐藏的计量单位（如用/50g 代替 /斤）、模糊定价或已知的宰客菜品。请用中文返回 JSON 格式结果。"
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trapsFound: { type: Type.ARRAY, items: { type: Type.STRING }, description: "发现的陷阱列表（中文）" },
            verdict: { type: Type.STRING, enum: ["SAFE", "CAUTION", "DANGER"], description: "判定结果" },
            explanation: { type: Type.STRING, description: "详细解释（中文）" }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as MenuAnalysis;
    }
    throw new Error("No analysis result");
  } catch (error) {
    console.error("Menu analysis failed:", error);
    throw error;
  }
};

/**
 * Edit Image using Gemini 2.5 Flash Image (Nano Banana)
 */
export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg', 
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image generated in response");
  } catch (error) {
    console.error("Image editing failed:", error);
    throw error;
  }
};

/**
 * Search for tourist destinations using Google Maps Grounding
 */
export const searchDestinations = async (location: string): Promise<DestinationResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `请推荐 5 个 ${location} 值得一去的旅游景点，并简要说明推荐理由。同时列出这些地方可能存在的“坑”或避雷建议。请用 Markdown 格式回复。`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const mapLinks = chunks
      .filter((c: any) => c.web?.uri || c.maps?.uri) 
      .map((c: any) => ({
        title: c.web?.title || c.maps?.title || "查看地图",
        uri: c.web?.uri || c.maps?.uri || "#"
      }));

    return {
      text: response.text || "未能获取相关信息",
      mapLinks
    };
  } catch (error) {
    console.error("Destination search failed:", error);
    throw error;
  }
};