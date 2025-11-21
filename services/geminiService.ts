import { GoogleGenAI } from "@google/genai";
import { AIRequestConfig } from "../types";

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateBiography = async (config: AIRequestConfig): Promise<string> => {
  const ai = getClient();
  
  const prompt = `
    Write a compelling and historically plausible (or based on provided facts) short biography for a person in a family tree.
    Language: Persian (Farsi).
    
    Details:
    Name: ${config.name}
    Birth Date: ${config.birthDate || 'Unknown'}
    Location: ${config.location || 'Unknown'}
    Relation in Tree: ${config.relation || 'Family Member'}
    
    Extra Context provided by user: ${config.extraContext || 'None'}
    
    Tone: Respectful, storytelling, genealogical.
    Length: Around 100-150 words.
    Output: Just the biography text, no markdown headers.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "متاسفانه نتوانستم بیوگرافی تولید کنم.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "خطا در ارتباط با سرویس هوش مصنوعی. لطفا کلید API را بررسی کنید.";
  }
};

export const suggestResearch = async (treeData: string): Promise<string> => {
    const ai = getClient();
    
    const prompt = `
      Act as a professional genealogist. Analyze this JSON structure representing a family tree and suggest 3 potential areas for research or missing information that stands out.
      Language: Persian (Farsi).
      Tree Data Summary: ${treeData.substring(0, 5000)} // Truncated for safety
      
      Output format: Bullet points.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      return response.text || "پیشنهادی یافت نشد.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "خطا در دریافت پیشنهادات.";
    }
  };