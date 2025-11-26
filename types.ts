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

export type AppMode = 'analyze' | 'generate' | 'remix';

export interface LoadingState {
  isLoading: boolean;
  message: string;
}
