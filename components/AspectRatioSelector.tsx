import React from 'react';
import { AspectRatio } from '../types';
import { Square, Smartphone, Monitor } from 'lucide-react';

interface AspectRatioSelectorProps {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({ value, onChange }) => {
  const ratios: { label: string; value: AspectRatio; icon: React.ReactNode }[] = [
    { label: 'Square (1:1)', value: '1:1', icon: <Square size={16} /> },
    { label: 'Portrait (3:4)', value: '3:4', icon: <Smartphone size={16} className="scale-y-90" /> },
    { label: 'Landscape (4:3)', value: '4:3', icon: <Monitor size={16} className="scale-x-90" /> },
    { label: 'Tall (9:16)', value: '9:16', icon: <Smartphone size={16} /> },
    { label: 'Wide (16:9)', value: '16:9', icon: <Monitor size={16} /> },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {ratios.map((ratio) => (
        <button
          key={ratio.value}
          onClick={() => onChange(ratio.value)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors
            ${value === ratio.value 
              ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}
          `}
        >
          {ratio.icon}
          {ratio.label}
        </button>
      ))}
    </div>
  );
};