export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface GeneratedImage {
  url: string;
  prompt: string;
}

export interface AnalysisResult {
  description: string;
  seoKeywords: string[];
  suggestedPrompt: string;
  customAnalysis?: string;
}

export interface PromptEnhancementResult {
  improvedPrompt: string;
  tips: string[];
}

export interface SearchResult {
  summary: string;
  sources: { title: string; uri: string }[];
}

export interface RemixHistoryItem {
  image: string;
  prompt: string;
  timestamp: number;
}

export interface AdaptationResult {
  analysis: string;
  strategy: string;
  suggestedPrompt: string;
}

export type AppMode = 'analyze' | 'product' | 'generate' | 'remix';

export interface LoadingState {
  isLoading: boolean;
  message: string;
}

declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
    hasSelectedApiKey: () => Promise<boolean>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}