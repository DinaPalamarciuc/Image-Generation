import React, { useRef } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  currentImage: string | null;
  onImageSelected: (base64: string) => void;
  label?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ currentImage, onImageSelected, label = "Upload Image" }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onImageSelected(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      
      {!currentImage ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-900/50 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all group h-64"
        >
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors text-slate-400">
            <Upload size={32} />
          </div>
          <p className="text-lg font-medium text-slate-300 mb-1">{label}</p>
          <p className="text-sm text-slate-500">Click to browse or drag & drop</p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
          <img src={currentImage} alt="Uploaded" className="w-full h-auto max-h-[400px] object-contain mx-auto" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-4 right-4 bg-slate-900/90 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2 backdrop-blur-sm border border-slate-700"
          >
            <ImageIcon size={16} />
            Change Image
          </button>
        </div>
      )}
    </div>
  );
};