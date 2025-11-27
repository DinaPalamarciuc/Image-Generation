import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio, AnalysisResult, PromptEnhancementResult, SearchResult, AdaptationResult } from "../types";

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
 * Analyzes a Product Image and a Reference Image to generate a blended prompt.
 */
export const analyzeProductAdaptation = async (productImage: string, referenceImage: string, apiKey?: string): Promise<AdaptationResult> => {
  const ai = getAI(apiKey);
  
  const productMime = getMimeType(productImage);
  const productData = cleanBase64(productImage);
  
  const refMime = getMimeType(referenceImage);
  const refData = cleanBase64(referenceImage);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { text: "Image 1: CLIENT PRODUCT (The object to feature)" },
        {
          inlineData: {
            mimeType: productMime,
            data: productData,
          },
        },
        { text: "Image 2: REFERENCE STYLE / COMPETITOR (The vibe, layout, and composition to mimic)" },
        {
          inlineData: {
            mimeType: refMime,
            data: refData,
          },
        },
        {
          text: `You are a creative director. Your task is to adapt the visual strategy of the Reference Image to feature the Client Product.

          1. Analyze the Reference Image: Extract the key "ideas" (lighting, color palette, composition, background elements, mood).
          2. Analyze the Client Product: Identify what it is (e.g., perfume bottle, sneaker, watch).
          3. Create a strategy: Explain how you will blend the product into the reference style.
          4. Write a HIGHLY DETAILED image generation prompt. The prompt must describe a scene that LOOKS like the Reference Image (same style/vibe) but features the Client Product instead of the original subject.

          Return JSON.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysis: { type: Type.STRING, description: "Analysis of the reference style and product" },
          strategy: { type: Type.STRING, description: "The plan for adaptation" },
          suggestedPrompt: { type: Type.STRING, description: "The final image generation prompt" }
        },
        required: ["analysis", "strategy", "suggestedPrompt"]
      }
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text) as AdaptationResult;
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
 * Performs a web search to gather visual identity information about a brand/competitor.
 */
export const searchVisualIdentity = async (query: string, apiKey?: string): Promise<SearchResult> => {
  const ai = getAI(apiKey);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [{ 
        text: `Search for the visual identity of '${query}'. 
        Focus specifically on:
        1. Official Brand Colors (Hex codes if possible).
        2. Logo characteristics and style (minimalist, mascot, serif/sans-serif, etc).
        3. Key visual themes or patterns used in their marketing.
        
        Provide a concise summary of these visual elements.` 
      }]
    },
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const text = response.text || "";
  
  // Extract sources from grounding metadata if available
  const sources: { title: string; uri: string }[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  
  if (groundingChunks) {
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title || "Source",
          uri: chunk.web.uri
        });
      }
    });
  }

  // Deduplicate sources by URI
  const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values()).slice(0, 3);

  return {
    summary: text,
    sources: uniqueSources
  };
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
 * Gets smart suggestions for next steps based on the generated/remixed image.
 */
export const getRemixSuggestions = async (base64Image: string, apiKey?: string): Promise<string[]> => {
  const ai = getAI(apiKey);
  const mimeType = getMimeType(base64Image);
  const data = cleanBase64(base64Image);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: data,
          },
        },
        {
          text: "Suggest 3 creative, short, and actionable follow-up prompts to edit or improve this image (e.g., 'Change time to night', 'Add neon lights'). Return ONLY the 3 prompts as a JSON array of strings."
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  const text = response.text || "[]";
  try {
    return JSON.parse(text);
  } catch {
    return ["Make it black and white", "Add a lens flare", "Change background to cyberpunk city"];
  }
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