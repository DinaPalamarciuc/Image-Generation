import React, { useState, useEffect } from 'react';
import { 
  Scan, 
  ImagePlus, 
  Wand2, 
  Download, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  Copy, 
  ChevronRight,
  Key,
  Lightbulb,
  ArrowRight,
  CheckCircle,
  XCircle,
  CreditCard,
  Edit,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from './components/Button';
import { AspectRatioSelector } from './components/AspectRatioSelector';
import { ImageUpload } from './components/ImageUpload';
import { ImageEditor } from './components/ImageEditor';
import { analyzeImage, generateNewImage, remixImage, enhancePrompt, validateApiKey } from './services/geminiService';
import { AppMode, AspectRatio, AnalysisResult, LoadingState, PromptEnhancementResult } from './types';

export default function App() {
  const [mode, setMode] = useState<AppMode>('analyze');
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [is403Error, setIs403Error] = useState(false);

  // API Key State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [keyValidationStatus, setKeyValidationStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');

  // Analysis State
  const [analysisImage, setAnalysisImage] = useState<string | null>(null);
  const [analysisInstruction, setAnalysisInstruction] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Generation State
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [enhancementResult, setEnhancementResult] = useState<PromptEnhancementResult | null>(null);

  // Remix State
  const [remixSourceImage, setRemixSourceImage] = useState<string | null>(null);
  const [remixPrompt, setRemixPrompt] = useState('');
  const [remixedImage, setRemixedImage] = useState<string | null>(null);
  const [isEditingRemixSource, setIsEditingRemixSource] = useState(false);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
    setKeyValidationStatus('idle');
  }, [apiKey]);

  const parseError = (err: any): string => {
    let message = err instanceof Error ? err.message : String(err);
    
    // Attempt to parse JSON error message if present
    if (message.includes('{')) {
      try {
        // extract JSON part if mixed with text
        const jsonMatch = message.match(/\{.*\}/s);
        if (jsonMatch) {
          const errorObj = JSON.parse(jsonMatch[0]);
          if (errorObj.error) {
            // Check for 403 specific codes
            if (errorObj.error.code === 403 || errorObj.error.status === 'PERMISSION_DENIED') {
              setIs403Error(true);
            }
            return errorObj.error.message || message;
          }
        }
      } catch (e) {
        // ignore parsing error
      }
    }

    if (message.includes('403') || message.includes('permission')) {
      setIs403Error(true);
    }
    
    return message;
  };

  const handleVerifyKey = async () => {
    setKeyValidationStatus('validating');
    const isValid = await validateApiKey(apiKey);
    setKeyValidationStatus(isValid ? 'success' : 'error');
    
    if (isValid) {
      setTimeout(() => setKeyValidationStatus('idle'), 3000);
    }
  };

  const handleSelectSystemKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // Clear manual key to ensure system key is used
        setApiKey('');
        // Optimistically set validation success
        setKeyValidationStatus('success');
        setTimeout(() => setKeyValidationStatus('idle'), 3000);
        // Clear previous errors
        setError(null);
        setIs403Error(false);
      } catch (e) {
        console.error("Failed to select key", e);
      }
    }
  };

  const handleError = (err: unknown, fallbackMessage: string) => {
    const parsedMsg = parseError(err);
    setError(parsedMsg || fallbackMessage);
    
    // If "Requested entity was not found", it implies a bad key state in the selector
    if (parsedMsg.includes("Requested entity was not found") && window.aistudio) {
      handleSelectSystemKey(); // Prompt user to select again
    }
  };

  const handleAnalysis = async () => {
    if (!analysisImage) return;
    setLoading({ isLoading: true, message: 'Analyzing image strategy with Gemini 3 Pro...' });
    setError(null);
    setIs403Error(false);
    try {
      const result = await analyzeImage(analysisImage, analysisInstruction, apiKey);
      setAnalysisResult(result);
    } catch (err) {
      handleError(err, 'Failed to analyze image');
    } finally {
      setLoading({ isLoading: false, message: '' });
    }
  };

  const handleEnhancePrompt = async () => {
    if (!generationPrompt) return;
    setLoading({ isLoading: true, message: 'Optimizing prompt with Gemini 2.5 Flash...' });
    setError(null);
    setIs403Error(false);
    try {
      const result = await enhancePrompt(generationPrompt, apiKey);
      setEnhancementResult(result);
    } catch (err) {
      handleError(err, 'Failed to enhance prompt');
    } finally {
      setLoading({ isLoading: false, message: '' });
    }
  };

  const applyEnhancedPrompt = () => {
    if (enhancementResult) {
      setGenerationPrompt(enhancementResult.improvedPrompt);
      setEnhancementResult(null);
    }
  };

  const handleGeneration = async () => {
    if (!generationPrompt) return;
    setLoading({ isLoading: true, message: 'Creating artwork with Gemini 3 Pro Image...' });
    setError(null);
    setIs403Error(false);
    try {
      const result = await generateNewImage(generationPrompt, aspectRatio, apiKey);
      setGeneratedImage(result);
    } catch (err) {
      handleError(err, 'Failed to generate image');
    } finally {
      setLoading({ isLoading: false, message: '' });
    }
  };

  const handleRemix = async () => {
    if (!remixSourceImage || !remixPrompt) return;
    setLoading({ isLoading: true, message: 'Remixing with Gemini 2.5 Flash Image...' });
    setError(null);
    setIs403Error(false);
    try {
      const result = await remixImage(remixSourceImage, remixPrompt, apiKey);
      setRemixedImage(result);
    } catch (err) {
      handleError(err, 'Failed to remix image');
    } finally {
      setLoading({ isLoading: false, message: '' });
    }
  };

  const handleSaveEditedImage = (newImage: string) => {
    setRemixSourceImage(newImage);
    setIsEditingRemixSource(false);
  };

  const transferPromptToGenerator = () => {
    if (analysisResult?.suggestedPrompt) {
      setGenerationPrompt(analysisResult.suggestedPrompt);
      setMode('generate');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTransferToRemix = (image: string) => {
    if (!image) return;
    setRemixSourceImage(image);
    setRemixPrompt(''); // Reset prompt for fresh edits
    setRemixedImage(null); // Clear previous remix result if any
    setMode('remix');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-100 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Gemini Lens & Canvas
            </h1>
          </div>
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'analyze', label: 'Analyze', icon: Scan },
              { id: 'remix', label: 'Remix', icon: Wand2 },
              { id: 'generate', label: 'Generate', icon: ImagePlus },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id as AppMode)}
                className={`
                  flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                  ${mode === tab.id 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'}
                `}
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Gemini API Key Input */}
        <div className="mb-8 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="bg-slate-800 p-2.5 rounded-lg text-indigo-400 border border-slate-700">
            <Key size={22} />
          </div>
          <div className="flex-1 w-full space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Gemini API Key
              </label>
              {window.aistudio && (
                <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Recommended for Pro Models
                </span>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {window.aistudio && (
                <Button 
                  onClick={handleSelectSystemKey}
                  variant="primary"
                  className="!py-1.5 !px-4 h-9 text-xs flex items-center gap-2 whitespace-nowrap"
                >
                  <CreditCard size={14} /> Select Paid API Key
                </Button>
              )}

              <div className="relative flex-1">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Or enter key manually..."
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-1.5 text-sm h-9"
                />
              </div>

              <Button 
                variant="outline" 
                onClick={handleVerifyKey} 
                disabled={keyValidationStatus === 'validating'}
                className="!py-1.5 !px-3 h-9 text-xs font-medium border-slate-700 bg-slate-800/50 hover:bg-slate-800"
              >
                {keyValidationStatus === 'validating' ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  'Verify'
                )}
              </Button>
            </div>
            
            {/* Status Messages */}
            <div className="min-h-[16px]">
              {keyValidationStatus === 'success' && (
                <p className="text-green-400 text-xs flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                  <CheckCircle size={12} /> Key is valid and active
                </p>
              )}
              {keyValidationStatus === 'error' && (
                <p className="text-red-400 text-xs flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                  <XCircle size={12} /> Key validation failed. Check permissions.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${is403Error ? 'bg-orange-500/10 border-orange-500/30 text-orange-200' : 'bg-red-500/10 border-red-500/20 text-red-200'}`}>
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium text-sm">{error}</p>
              {is403Error && window.aistudio && (
                <div className="text-xs opacity-90">
                  <p className="mb-2">This usually means the project lacks billing/permissions for this model.</p>
                  <button 
                    onClick={handleSelectSystemKey}
                    className="underline hover:text-white font-semibold"
                  >
                    Click here to select a Paid API Key
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYZE MODE */}
        {mode === 'analyze' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-bold text-white">Competitor Analysis & Adaptation</h2>
              <p className="text-slate-400">Analyze images, get SEO data, or adapt competitor concepts using <span className="text-indigo-400 font-mono">gemini-3-pro</span>.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <ImageUpload 
                  currentImage={analysisImage} 
                  onImageSelected={setAnalysisImage}
                  label="Upload competitor or source image"
                />

                {analysisImage && (
                  <Button 
                    variant="outline" 
                    fullWidth 
                    className="text-xs !py-2 border-slate-800 bg-slate-900/50"
                    onClick={() => handleTransferToRemix(analysisImage)}
                  >
                    <Wand2 size={14} className="mr-2" /> Remix this Image
                  </Button>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Adaptation & Strategy (Optional)</label>
                  <textarea
                    value={analysisInstruction}
                    onChange={(e) => setAnalysisInstruction(e.target.value)}
                    placeholder='e.g., "Analyze this ad layout but replace the bottle with my blue perfume bottle", or "Keep the lighting but change the setting to a beach".'
                    className="w-full h-24 bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none placeholder:text-slate-600 text-sm"
                  />
                </div>

                <Button 
                  fullWidth 
                  onClick={handleAnalysis} 
                  disabled={!analysisImage || loading.isLoading}
                >
                  {loading.isLoading ? (
                    <><Loader2 className="animate-spin mr-2" /> {loading.message}</>
                  ) : (
                    'Analyze & Adapt'
                  )}
                </Button>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-6 min-h-[400px]">
                {!analysisResult ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <Scan size={48} className="opacity-20" />
                    <p>Upload an image to start analysis.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Custom Answer Section */}
                    {analysisResult.customAnalysis && (
                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-lg animate-in fade-in slide-in-from-top-2">
                        <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Lightbulb size={14} /> Adaptation Strategy
                        </h3>
                        <p className="text-slate-200 leading-relaxed text-sm">{analysisResult.customAnalysis}</p>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Visual Description</h3>
                      <p className="text-slate-200 leading-relaxed text-sm">{analysisResult.description}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">SEO Keywords</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.seoKeywords.map((kw, i) => (
                          <span key={i} className="px-2 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Sparkles size={14} className="text-amber-400" /> 
                          Adapted Generation Prompt
                        </h3>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-400 font-mono leading-relaxed mb-4">
                        {analysisResult.suggestedPrompt}
                      </div>
                      <Button 
                        fullWidth 
                        variant="primary"
                        onClick={transferPromptToGenerator}
                        className="group"
                      >
                         Create Adapted Image <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REMIX MODE */}
        {mode === 'remix' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-bold text-white">Magic Remix</h2>
              <p className="text-slate-400">Edit images using natural language prompts powered by <span className="text-indigo-400 font-mono">gemini-2.5-flash-image</span>.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                
                {isEditingRemixSource && remixSourceImage ? (
                  <ImageEditor 
                    image={remixSourceImage} 
                    onSave={handleSaveEditedImage} 
                    onCancel={() => setIsEditingRemixSource(false)} 
                  />
                ) : (
                  <>
                    <div className="relative group">
                      <ImageUpload 
                        currentImage={remixSourceImage} 
                        onImageSelected={setRemixSourceImage}
                        label="Upload image to edit"
                      />
                      {remixSourceImage && (
                        <div className="absolute top-4 right-4 flex gap-2">
                          <Button 
                             variant="secondary" 
                             onClick={() => setIsEditingRemixSource(true)}
                             className="!px-3 !py-1.5 text-xs shadow-lg"
                          >
                             <SlidersHorizontal size={14} className="mr-1.5" /> Tools
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Instructions</label>
                      <textarea
                        value={remixPrompt}
                        onChange={(e) => setRemixPrompt(e.target.value)}
                        placeholder='e.g., "Make it a sunset scene", "Add a red hat", "Apply a cyberpunk filter"'
                        className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none placeholder:text-slate-600"
                      />
                    </div>

                    <Button 
                      fullWidth 
                      onClick={handleRemix} 
                      disabled={!remixSourceImage || !remixPrompt || loading.isLoading}
                    >
                      {loading.isLoading ? (
                        <><Loader2 className="animate-spin mr-2" /> {loading.message}</>
                      ) : (
                        <><Wand2 size={18} className="mr-2" /> Remix Image</>
                      )}
                    </Button>
                  </>
                )}
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 p-2 flex items-center justify-center min-h-[400px]">
                {!remixedImage ? (
                  <div className="text-slate-500 flex flex-col items-center">
                    <Wand2 size={48} className="opacity-20 mb-4" />
                    <p>Result will appear here</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full group">
                    <img src={remixedImage} alt="Remixed" className="w-full h-full object-contain rounded-lg" />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm rounded-lg">
                      <Button onClick={() => downloadImage(remixedImage, 'remix.png')} variant="secondary">
                        <Download size={18} className="mr-2" /> Download
                      </Button>
                      <Button onClick={() => handleTransferToRemix(remixedImage)} variant="primary">
                        <Wand2 size={18} className="mr-2" /> Continue Editing
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GENERATE MODE */}
        {mode === 'generate' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-bold text-white">Studio Generation</h2>
              <p className="text-slate-400">Create high-fidelity visuals with prompt assistance using <span className="text-indigo-400 font-mono">gemini-3-pro-image</span>.</p>
            </div>

            <div className="grid md:grid-cols-5 gap-8">
              {/* Left sidebar for controls */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Prompt Section with Enhancement */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-300">Prompt</label>
                    <button
                      onClick={handleEnhancePrompt}
                      disabled={!generationPrompt || loading.isLoading}
                      className="text-xs flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Sparkles size={12} /> Enhance Prompt
                    </button>
                  </div>
                  
                  <textarea
                    value={generationPrompt}
                    onChange={(e) => setGenerationPrompt(e.target.value)}
                    placeholder="Describe the image you want to create in detail..."
                    className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none placeholder:text-slate-600 text-sm"
                  />

                  {/* Enhancement Recommendation Card */}
                  {enhancementResult && (
                    <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-indigo-300 font-medium text-sm">
                        <Sparkles size={14} /> 
                        <span>Suggested Improvement</span>
                      </div>
                      
                      <div className="space-y-1.5">
                         <p className="text-xs font-medium text-slate-400">Optimized Prompt:</p>
                         <div className="bg-slate-950/50 p-3 rounded border border-indigo-500/20 text-xs text-slate-200 font-mono leading-relaxed">
                          {enhancementResult.improvedPrompt}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                           <Lightbulb size={12} className="text-amber-400" />
                           <span>Why this works:</span>
                        </p>
                        <ul className="space-y-1.5 bg-slate-900/40 p-3 rounded border border-slate-800/50">
                          {enhancementResult.tips.map((tip, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                              <span className="block w-1 h-1 mt-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <span className="leading-snug">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <Button 
                        variant="secondary" 
                        fullWidth 
                        onClick={applyEnhancedPrompt}
                        className="!py-2 !text-xs !h-auto border border-indigo-500/20 hover:bg-indigo-500/10 hover:text-indigo-200"
                      >
                        Apply Improved Prompt
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">Aspect Ratio</label>
                  <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
                </div>

                <Button 
                  fullWidth 
                  onClick={handleGeneration}
                  disabled={!generationPrompt || loading.isLoading}
                >
                  {loading.isLoading ? (
                    <><Loader2 className="animate-spin mr-2" /> {loading.message}</>
                  ) : (
                    <><ImagePlus size={18} className="mr-2" /> Generate Art</>
                  )}
                </Button>
              </div>

              {/* Right area for result */}
              <div className="md:col-span-3 bg-slate-900 rounded-xl border border-slate-800 p-2 flex items-center justify-center min-h-[500px]">
                {!generatedImage ? (
                  <div className="text-slate-500 flex flex-col items-center">
                    <Sparkles size={48} className="opacity-20 mb-4" />
                    <p>Your masterpiece will appear here</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center group">
                    <img src={generatedImage} alt="Generated" className="max-w-full max-h-[600px] object-contain rounded-lg shadow-2xl shadow-black" />
                     <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm rounded-lg">
                      <Button onClick={() => downloadImage(generatedImage, 'generated-art.png')} variant="secondary">
                        <Download size={18} className="mr-2" /> Download
                      </Button>
                      <Button onClick={() => handleTransferToRemix(generatedImage)} variant="primary">
                        <Wand2 size={18} className="mr-2" /> Edit / Remix
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
