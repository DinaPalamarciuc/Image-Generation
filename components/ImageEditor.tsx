import React, { useState, useRef, useEffect } from 'react';
import { Check, X, RotateCw, Crop, Sun, Contrast, Undo2, Redo2, History } from 'lucide-react';
import { Button } from './Button';

interface ImageEditorProps {
  image: string;
  onSave: (newImage: string) => void;
  onCancel: () => void;
}

type CropRatio = 'original' | '1:1' | '16:9' | '4:3' | '3:4' | '9:16';

interface EditorState {
  brightness: number;
  contrast: number;
  rotation: number;
  cropRatio: CropRatio;
}

const INITIAL_STATE: EditorState = {
  brightness: 100,
  contrast: 100,
  rotation: 0,
  cropRatio: 'original',
};

const AUTOSAVE_KEY = 'gemini_editor_autosave';

export const ImageEditor: React.FC<ImageEditorProps> = ({ image, onSave, onCancel }) => {
  // Current active state
  const [brightness, setBrightness] = useState(INITIAL_STATE.brightness);
  const [contrast, setContrast] = useState(INITIAL_STATE.contrast);
  const [rotation, setRotation] = useState(INITIAL_STATE.rotation);
  const [cropRatio, setCropRatio] = useState<CropRatio>(INITIAL_STATE.cropRatio);

  // History management
  const [history, setHistory] = useState<EditorState[]>([INITIAL_STATE]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-save availability
  const [hasAutosave, setHasAutosave] = useState(false);

  // Canvas ref for logic, though mostly used during Save
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper to generate a signature for the image to ensure we only restore edits for the same image
  const getImageSignature = (imgData: string) => {
    if (!imgData) return '';
    // Use length and start/end chars as a lightweight checksum
    return `${imgData.length}-${imgData.slice(0, 30)}-${imgData.slice(-30)}`;
  };

  // Check for existing autosave on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.imageSignature === getImageSignature(image)) {
          setHasAutosave(true);
        }
      }
    } catch (e) {
      console.error("Error reading autosave", e);
    }
  }, [image]);

  // Auto-save loop
  useEffect(() => {
    const timer = setTimeout(() => {
      const stateToSave = {
        imageSignature: getImageSignature(image),
        brightness,
        contrast,
        rotation,
        cropRatio,
        history,
        currentIndex,
        timestamp: Date.now()
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateToSave));
    }, 2000); // Save every 2 seconds if changes occur

    return () => clearTimeout(timer);
  }, [brightness, contrast, rotation, cropRatio, history, currentIndex, image]);

  const handleRestoreAutosave = () => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.imageSignature === getImageSignature(image)) {
           setBrightness(parsed.brightness);
           setContrast(parsed.contrast);
           setRotation(parsed.rotation);
           setCropRatio(parsed.cropRatio);
           setHistory(parsed.history);
           setCurrentIndex(parsed.currentIndex);
           // After restoring, we can optionally clear the autosave flag or keep it until next change
        }
      }
    } catch (e) {
      console.error("Failed to restore", e);
    }
  };

  // Helper to calculate dimensions based on crop ratio
  const getCropDimensions = (imgWidth: number, imgHeight: number, ratio: CropRatio) => {
    if (ratio === 'original') return { width: imgWidth, height: imgHeight, x: 0, y: 0 };

    const [rw, rh] = ratio.split(':').map(Number);
    const targetRatio = rw / rh;
    const currentRatio = imgWidth / imgHeight;

    let width = imgWidth;
    let height = imgHeight;

    if (currentRatio > targetRatio) {
      // Image is wider than target
      width = imgHeight * targetRatio;
    } else {
      // Image is taller than target
      height = imgWidth / targetRatio;
    }

    const x = (imgWidth - width) / 2;
    const y = (imgHeight - height) / 2;

    return { width, height, x, y };
  };

  const generateFinalImage = () => {
    const img = new Image();
    img.src = image;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Step 1: Handle Rotation
      // We create a temporary canvas for the rotated full image
      const isRotatedSideways = rotation % 180 !== 0;
      const rotatedWidth = isRotatedSideways ? img.height : img.width;
      const rotatedHeight = isRotatedSideways ? img.width : img.height;
      
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = rotatedWidth;
      rotCanvas.height = rotatedHeight;
      const rotCtx = rotCanvas.getContext('2d');
      if (!rotCtx) return;

      rotCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      rotCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
      rotCtx.rotate((rotation * Math.PI) / 180);
      rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

      // Step 2: Handle Crop
      // Now we crop from the rotated canvas
      const crop = getCropDimensions(rotatedWidth, rotatedHeight, cropRatio);
      
      canvas.width = crop.width;
      canvas.height = crop.height;
      
      // Draw the section of the rotated image onto the final canvas
      ctx.drawImage(
        rotCanvas, 
        crop.x, crop.y, crop.width, crop.height, // Source rect
        0, 0, crop.width, crop.height // Dest rect
      );

      // Clear autosave for this session as we are applying changes
      // localStorage.removeItem(AUTOSAVE_KEY); // Optional: Keep it or clear it. Keeping it allows "re-editing" if they cancel next time.

      onSave(canvas.toDataURL('image/png'));
    };
  };

  // --- History Logic ---

  const applyState = (state: EditorState) => {
    setBrightness(state.brightness);
    setContrast(state.contrast);
    setRotation(state.rotation);
    setCropRatio(state.cropRatio);
  };

  const addToHistory = (newState: EditorState) => {
    const currentState = history[currentIndex];
    
    // Check for deep equality to prevent redundant history entries
    if (
      currentState.brightness === newState.brightness &&
      currentState.contrast === newState.contrast &&
      currentState.rotation === newState.rotation &&
      currentState.cropRatio === newState.cropRatio
    ) {
      return;
    }

    // If we are in the middle of the history, slice off the future
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(newState);
    
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      applyState(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      applyState(history[newIndex]);
    }
  };

  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    addToHistory({
      brightness,
      contrast,
      rotation: newRotation,
      cropRatio
    });
  };

  const handleCropChange = (ratio: CropRatio) => {
    setCropRatio(ratio);
    addToHistory({
      brightness,
      contrast,
      rotation,
      cropRatio: ratio
    });
  };

  // Commits the current slider values to history
  const commitSliderChange = () => {
    addToHistory({
      brightness,
      contrast,
      rotation,
      cropRatio
    });
  };

  const handleReset = () => {
    // Reset visual state
    applyState(INITIAL_STATE);
    // Clear history stack completely
    setHistory([INITIAL_STATE]);
    setCurrentIndex(0);
  };

  // CSS transform for live preview
  const previewStyle = {
    transform: `rotate(${rotation}deg)`,
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
    transition: 'transform 0.3s ease, filter 0.2s ease',
    maxWidth: '100%',
    maxHeight: '400px',
    objectFit: 'contain' as const,
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h3 className="font-medium text-slate-200">Edit Image</h3>
        <div className="flex gap-2">
          {hasAutosave && (
            <Button 
              variant="ghost"
              onClick={handleRestoreAutosave}
              className="!p-2 h-8 w-auto text-xs px-3 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 mr-2 border border-indigo-500/20"
              title="Restore last autosaved session"
            >
              <History size={14} className="mr-1.5" /> Restore Session
            </Button>
          )}

          <div className="flex mr-2 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <Button 
              variant="ghost" 
              onClick={handleUndo} 
              disabled={currentIndex === 0}
              title="Undo" 
              className="!p-1.5 h-8 w-8 disabled:opacity-30 hover:bg-slate-700"
            >
              <Undo2 size={16} />
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleRedo} 
              disabled={currentIndex === history.length - 1}
              title="Redo" 
              className="!p-1.5 h-8 w-8 disabled:opacity-30 hover:bg-slate-700"
            >
              <Redo2 size={16} />
            </Button>
          </div>
          
          <Button variant="ghost" onClick={handleReset} title="Reset All" className="!p-2 h-8 w-auto text-xs px-3 text-slate-400 hover:text-white">
            Reset
          </Button>
          <div className="w-px bg-slate-700 mx-1 h-6 self-center"></div>
          <Button variant="ghost" onClick={onCancel} title="Cancel" className="!p-2 h-8 w-8 text-slate-400 hover:text-white hover:bg-red-500/10 hover:text-red-400">
            <X size={16} />
          </Button>
          <Button variant="primary" onClick={generateFinalImage} title="Apply Changes" className="!py-1.5 !px-3 text-xs h-8">
            <Check size={14} className="mr-1.5" /> Apply
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="relative h-[400px] w-full bg-slate-950/50 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800/50">
        <div className={`relative overflow-hidden flex items-center justify-center transition-all duration-300`}
             style={{ 
               width: cropRatio === 'original' ? '100%' : 'auto',
               height: cropRatio === 'original' ? '100%' : 'auto',
               aspectRatio: cropRatio === 'original' ? 'auto' : cropRatio.replace(':', '/')
             }}>
           <img src={image} style={previewStyle} alt="Preview" className="max-w-full max-h-full" />
           
           {/* Crop Overlay Guide if not original */}
           {cropRatio !== 'original' && (
             <div className="absolute inset-0 pointer-events-none border-2 border-indigo-500/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] z-10 transition-all duration-300" 
                  style={{
                    aspectRatio: cropRatio.replace(':', '/'),
                    width: '100%', 
                    height: '100%',
                    margin: 'auto'
                  }}>
                <div className="absolute top-2 left-2 bg-indigo-500 text-white text-[10px] px-1.5 rounded shadow">
                  Crop {cropRatio}
                </div>
             </div>
           )}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Adjustments */}
        <div className="space-y-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Adjustments</label>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Sun size={12}/> Brightness</span>
              <span>{brightness}%</span>
            </div>
            <input 
              type="range" min="0" max="200" value={brightness} 
              onChange={(e) => setBrightness(Number(e.target.value))}
              onMouseUp={commitSliderChange}
              onTouchEnd={commitSliderChange}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Contrast size={12}/> Contrast</span>
              <span>{contrast}%</span>
            </div>
            <input 
              type="range" min="0" max="200" value={contrast} 
              onChange={(e) => setContrast(Number(e.target.value))}
              onMouseUp={commitSliderChange}
              onTouchEnd={commitSliderChange}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
            />
          </div>
        </div>

        {/* Transform Tools */}
        <div className="space-y-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transform</label>
          
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              onClick={handleRotate} 
              className="flex-1 !py-2 text-xs flex-col gap-1 h-auto bg-slate-800 border border-slate-700 hover:border-slate-600"
            >
              <RotateCw size={16} />
              <span>Rotate 90°</span>
            </Button>
          </div>

          <div className="space-y-2">
             <div className="text-xs text-slate-400 flex items-center gap-1.5">
               <Crop size={12} /> Crop Ratio (Center)
             </div>
             <div className="grid grid-cols-3 gap-2">
               {(['original', '1:1', '16:9', '4:3', '9:16'] as CropRatio[]).map((ratio) => (
                 <button
                   key={ratio}
                   onClick={() => handleCropChange(ratio)}
                   className={`
                     px-2 py-1.5 text-xs rounded border transition-colors
                     ${cropRatio === ratio 
                       ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                       : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
                   `}
                 >
                   {ratio === 'original' ? 'Free' : ratio}
                 </button>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};