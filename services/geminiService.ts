import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio, AnalysisResult, PromptEnhancementResult } from "../types";

// Helper to get the AI client with the correct key
const getAI = (apiKey?: string) => {
  const key = apiKey?.trim() || process.env.API_KEY;
  if (!key) {
    throw new Error("No API Key found. Please provided a Gemini API Key or ensure the environment variable is set.");
  }
  return new GoogleGenAI({ apiKey: key });
};

// Helper to strip the data:image/xyz;base64, prefix
const cleanBase64 = (base64Data: string) => {
  return base64Data.split(',')[1];
};

const getMimeType = (base64Data: string) => {
  return base64Data.split(';')[0].split(':')[1];
};

/**
 * Analyzes an image using gemini-3-pro-preview for complex reasoning.
 * Returns an SEO description, keywords, and a DALL-E style prompt.
 * Optionally handles a specific user instruction about the image.
 */
export const analyzeImage = async (base64Image: string, customInstruction?: string, apiKey?: string): Promise<AnalysisResult> => {
  const ai = getAI(apiKey);
  const mimeType = getMimeType(base64Image);
  const data = cleanBase64(base64Image);

  const promptText = `Analyze this image in extreme detail. 
  
  1. Provide a professional description suitable for an image alt tag or SEO meta description.
  2. List 5-10 relevant SEO keywords.
  3. Write a highly detailed image generation prompt (DALL-E 3 style) to recreate this image. 
     CRITICAL: If a USER INSTRUCTION is provided below, you MUST modify this prompt to incorporate the user's request (e.g., "swap the product", "change the background", "improve the lighting") while maintaining the professional composition of the original image.
  
  ${customInstruction ? `4. SPECIFIC USER INSTRUCTION: "${customInstruction}". 
     - Provide a detailed strategic answer/analysis to this instruction in the 'customAnalysis' field.
     - Ensure the 'suggestedPrompt' reflects this adaptation.` : ''}
  
  Return the result in JSON format.`;

  const schemaProperties: any = {
    description: { type: Type.STRING },
    seoKeywords: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    suggestedPrompt: { type: Type.STRING }
  };

  const requiredFields = ["description", "seoKeywords", "suggestedPrompt"];

  if (customInstruction) {
    schemaProperties.customAnalysis = { type: Type.STRING, description: "Answer to the specific user instruction" };
    requiredFields.push("customAnalysis");
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: data,
          },
        },
        {
          text: promptText
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: schemaProperties,
        required: requiredFields
      }
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text) as AnalysisResult;
};

/**
 * Enhances a user's prompt using gemini-2.5-flash.
 */
export const enhancePrompt = async (currentPrompt: string, apiKey?: string): Promise<PromptEnhancementResult> => {
  const ai = getAI(apiKey);
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [{
        text: `You are an expert prompt engineer for AI image generation. 
        Analyze the following prompt: "${currentPrompt}".
        
        1. Rewrite it to be more descriptive, artistic, and effective for a high-quality image generator.
        2. Provide 3 specific tips on why you made these changes or how the user can improve their prompting.
        
        Return JSON.`
      }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          improvedPrompt: { type: Type.STRING },
          tips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["improvedPrompt", "tips"]
      }
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text) as PromptEnhancementResult;
};

/**
 * Generates an image using gemini-3-pro-image-preview.
 * Supports aspect ratio control.
 */
export const generateNewImage = async (prompt: string, aspectRatio: AspectRatio, apiKey?: string): Promise<string> => {
  const ai = getAI(apiKey);
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "1K" 
      }
    }
  });

  // Handle image response
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("No image generated.");
};

/**
 * Remixes (edits) an existing image using gemini-2.5-flash-image (Nano Banana).
 */
export const remixImage = async (base64Image: string, prompt: string, apiKey?: string): Promise<string> => {
  const ai = getAI(apiKey);
  const mimeType = getMimeType(base64Image);
  const data = cleanBase64(base64Image);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: data,
          },
        },
        {
          text: prompt
        }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No remixed image returned.");
};

/**
 * Validates the API key by attempting a minimal generation request.
 */
export const validateApiKey = async (apiKey?: string): Promise<boolean> => {
  try {
    const ai = getAI(apiKey);
    // Use the lightest model for a quick ping
    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: 'ping' }] },
    });
    return true;
  } catch (error) {
    console.warn("API Key validation failed:", error);
    return false;
  }
};
