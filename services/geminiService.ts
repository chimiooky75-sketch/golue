import { GoogleGenAI, Type } from "@google/genai";
import { RiskAnalysis, MenuAnalysis, DestinationResult, RoutePlan } from "../types";

// Helper to get initialized client or throw error if key is missing
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// --- MOCK DATA FOR DEMO FALLBACK (演示数据) ---

const MOCK_ROUTE_PLAN: RoutePlan = {
  title: "厦门文艺慢游 (演示模式 - API未配置)",
  nodes: [
    { id: 1, name: "南普陀寺", description: "闽南佛教圣地，背依五老峰，可登高望远。", type: "SCENERY", estimatedStay: "1.5小时" },
    { id: 2, name: "厦大白城沙滩", description: "漫步环岛路木栈道，打卡双子塔合影位。", type: "SCENERY", estimatedStay: "1小时" },
    { id: 3, name: "沙坡尾", description: "老厦门避风坞改造的艺术西区，网红店云集。", type: "FOOD", estimatedStay: "2小时" },
    { id: 4, "name": "顶澳仔猫街", "description": "猫咪主题文化街区，有很多可爱的涂鸦和周边。", "type": "OTHER", "estimatedStay": "40分钟" },
    { id: 5, name: "中山路步行街", description: "南洋骑楼建筑群，品尝土笋冻、沙茶面。", type: "FOOD", estimatedStay: "2小时" }
  ],
  edges: [
    { from: 1, to: 2, transportMode: "WALK", duration: "15分钟", distance: "900m", details: "步行经厦大南门" },
    { from: 2, to: 3, transportMode: "TAXI", duration: "8分钟", distance: "2.5km", details: "打车约15元" },
    { from: 3, to: 4, transportMode: "WALK", duration: "10分钟", distance: "600m", details: "沿大学路步行" },
    { from: 4, to: 5, transportMode: "BUS", duration: "25分钟", distance: "3.5km", details: "公交 1路 / 22路" }
  ]
};

const MOCK_RISK_ANALYSIS: RiskAnalysis = {
  score: 85,
  summary: "⚠️ 检测到典型消费陷阱！(演示数据：API未连接，仅供参考) 该行程包含高风险的海鲜加工店和非正规一日游项目。",
  risks: [
    { location: "某某海鲜大排档", riskLevel: "HIGH", reason: "典型“阴阳菜单”高发区，出租车司机回扣店。", suggestion: "请务必在大众点评查看最新差评，推荐去八市自己买。" },
    { location: "珍珠购买", riskLevel: "MEDIUM", reason: "路边摊多为塑料仿制品，价格虚高。", suggestion: "不仅要砍价，更建议去正规商场专柜。" },
    { location: "茶艺表演", riskLevel: "LOW", reason: "可能存在推销高价茶叶环节。", suggestion: "保持理智，只喝不买，或明确拒绝。" }
  ]
};

const MOCK_MENU_ANALYSIS: MenuAnalysis = {
  trapsFound: ["隐藏计量单位：/50g 而非 /500g", "加工费未明确标注", "时价菜品未提前告知"],
  verdict: "DANGER",
  explanation: "这是一张典型的针对游客的“杀猪”菜单 (演示模式)。注意看右下角极小的字体标注了价格单位为50克，实际价格是标价的10倍。建议立即离开或拨打12315。"
};

const MOCK_DESTINATION_RESULT: DestinationResult = {
  text: "### 推荐景点 (演示数据)\n\n由于未连接 API，以下是默认推荐：\n\n1. **鼓浪屿**: 世界文化遗产，建筑博物馆。\n2. **环岛路**: 最美马拉松赛道，适合骑行。\n3. **植物园**: 雨林世界和多肉植物区是拍照圣地。\n\n**⚠️ 避雷建议**: 鼓浪屿上的“老字号”馅饼很多是贴牌的；渡轮票需提前在支付宝购买。",
  mapLinks: [
    { title: "鼓浪屿轮渡码头", uri: "https://www.google.com/maps/search/?api=1&query=鼓浪屿" },
    { title: "厦门园林植物园", uri: "https://www.google.com/maps/search/?api=1&query=厦门植物园" }
  ]
};

// Helper to handle API failures gracefully by returning mock data
const handleApiError = (error: any, mockData: any, serviceName: string) => {
  console.error(`${serviceName} failed:`, error);
  const isKeyError = error.message === "API_KEY_MISSING" || error.message?.includes('API key');
  const isNetError = error.message?.includes('fetch failed') || error.message?.includes('Network');
  
  if (isKeyError || isNetError) {
    console.warn(`Falling back to MOCK data for ${serviceName} due to missing Key or Network error.`);
    // Simulate network delay for realism
    return new Promise(resolve => setTimeout(() => resolve(mockData), 1000));
  }
  throw error;
};

/**
 * Generate a structured route plan with transport estimates from text
 */
export const generateRoutePlan = async (text: string): Promise<RoutePlan> => {
  try {
    const ai = getAiClient();
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
    throw new Error("模型未返回有效数据");
  } catch (error: any) {
    return handleApiError(error, MOCK_ROUTE_PLAN, "Route Generation") as Promise<RoutePlan>;
  }
};

/**
 * Analyze text itinerary for travel scams
 */
export const analyzeItinerary = async (text: string): Promise<RiskAnalysis> => {
  try {
    const ai = getAiClient();
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
  } catch (error: any) {
    return handleApiError(error, MOCK_RISK_ANALYSIS, "Itinerary Analysis") as Promise<RiskAnalysis>;
  }
};

/**
 * Analyze menu image for pricing traps using OCR and reasoning
 */
export const analyzeMenuImage = async (base64Image: string): Promise<MenuAnalysis> => {
  try {
    const ai = getAiClient();
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
  } catch (error: any) {
    return handleApiError(error, MOCK_MENU_ANALYSIS, "Menu Analysis") as Promise<MenuAnalysis>;
  }
};

/**
 * Edit Image using Gemini 2.5 Flash Image (Nano Banana)
 */
export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const ai = getAiClient();
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
  } catch (error: any) {
    const isKeyError = error.message === "API_KEY_MISSING" || error.message?.includes('API key');
    if (isKeyError) {
      throw new Error("API Key 未配置，无法使用 AI 修图功能。");
    }
    console.error("Image editing failed:", error);
    throw error;
  }
};

/**
 * Search for tourist destinations using Google Maps Grounding
 */
export const searchDestinations = async (location: string): Promise<DestinationResult> => {
  try {
    const ai = getAiClient();
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
  } catch (error: any) {
    return handleApiError(error, MOCK_DESTINATION_RESULT, "Destination Search") as Promise<DestinationResult>;
  }
};