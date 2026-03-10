import React from 'react';
import { useDesign, MAP_TEMPLATES } from '@/contexts/DesignContext';
import { Settings, Palette, Share2, Layers, Sliders } from 'lucide-react';

export default function DesignFloatingTab() {
  const { 
    theme, 
    lineStyle, 
    shape, 
    curvature, 
    updateDesign, 
    isLoaded 
  } = useDesign();

  // הגנה: אם ה-Context עדיין לא נטען, מציגים מצב טעינה מינימלי
  if (!isLoaded) return null;

  const handleThemeChange = (newTheme) => {
    const template = MAP_TEMPLATES[newTheme] || MAP_TEMPLATES.modern;
    updateDesign({ 
      theme: newTheme, 
      shape: template.node 
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/90 backdrop-blur-md shadow-2xl rounded-2xl border border-slate-200 p-2 flex items-center gap-2">
      {/* בחירת ערכת נושא */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        {Object.keys(MAP_TEMPLATES).map((t) => (
          <button
            key={t}
            onClick={() => handleThemeChange(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              theme === t 
                ? 'bg-white shadow-sm text-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="h-8 w-[1px] bg-slate-200 mx-2" />

      {/* שליטה על קימור קווים */}
      <div className="flex items-center gap-3 px-3">
        <Sliders className="w-4 h-4 text-slate-400" />
        <div className="flex flex-col w-32">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={curvature || 0.5}
            onChange={(e) => updateDesign({ curvature: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>ישר</span>
            <span>אורגני</span>
          </div>
        </div>
      </div>

      <div className="h-8 w-[1px] bg-slate-200 mx-2" />

      {/* סגנון קווים */}
      <select
        value={lineStyle || 'tapered'}
        onChange={(e) => updateDesign({ lineStyle: e.target.value })}
        className="bg-transparent text-sm font-medium text-slate-600 focus:outline-none cursor-pointer px-2"
      >
        <option value="tapered">קו מדורג</option>
        <option value="tapered-dashed">מקווקו</option>
        <option value="tapered-dotted">נקודות</option>
        <option value="straight">חלק</option>
      </select>

      <div className="h-8 w-[1px] bg-slate-200 mx-2" />

      {/* צורת בועות ברירת מחדל */}
      <div className="flex gap-1">
        {['bubble', 'cloud', 'rect'].map((s) => (
          <button
            key={s}
            onClick={() => updateDesign({ shape: s })}
            className={`p-2 rounded-lg transition-all ${
              shape === s ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <div className={`w-4 h-4 border-2 rounded-sm ${shape === s ? 'border-blue-600' : 'border-current'}`} 
                 style={{ borderRadius: s === 'bubble' ? '50%' : s === 'cloud' ? '40% 60% 40% 60%' : '2px' }} />
          </button>
        ))}
      </div>
    </div>
  );
}
