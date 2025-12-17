import React, { useState, useRef } from 'react';
import { editImageWithGemini } from '../services/geminiService';
import { ImageEditState } from '../types';

const PhotoMagic: React.FC = () => {
  const [state, setState] = useState<ImageEditState>({
    originalUrl: null,
    generatedUrl: null,
    prompt: '',
    isProcessing: false,
    error: null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setState(prev => ({ 
          ...prev, 
          originalUrl: reader.result as string, 
          generatedUrl: null,
          error: null 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!state.originalUrl || !state.prompt.trim()) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      // Clean base64 string
      const base64Data = state.originalUrl.split(',')[1];
      const generatedImage = await editImageWithGemini(base64Data, state.prompt);
      
      setState(prev => ({
        ...prev,
        generatedUrl: generatedImage,
        isProcessing: false
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: "图片处理失败，请尝试更换描述或图片。"
      }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-6 rounded-xl shadow-lg text-white mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          旅游照魔法消除
        </h2>
        <p className="opacity-90 mt-1">
          AI 帮你消除路人、换天空、加滤镜。
        </p>
        <p className="text-xs mt-2 bg-white/20 inline-block px-2 py-1 rounded">Powered by Gemini 2.5 Flash Image</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
        {/* Input Column */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-64 lg:h-80 flex flex-col items-center justify-center relative bg-slate-50 overflow-hidden">
             {state.originalUrl ? (
               <img src={state.originalUrl} alt="Original" className="w-full h-full object-contain" />
             ) : (
               <div className="text-center p-6">
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-pink-400 hover:text-pink-500 transition-colors group"
                 >
                   <svg className="w-10 h-10 mx-auto text-slate-400 group-hover:text-pink-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   <span className="font-semibold text-slate-500 group-hover:text-pink-500">上传照片</span>
                 </button>
               </div>
             )}
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
             {state.originalUrl && (
               <button 
                onClick={() => { setState(s => ({...s, originalUrl: null, generatedUrl: null})); }}
                className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full hover:bg-white text-slate-600 shadow-sm"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             )}
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">你想怎么修？</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={state.prompt}
                onChange={(e) => setState(s => ({...s, prompt: e.target.value}))}
                placeholder="例如：'把红衣服的人去掉', '换成夕阳背景', '加个复古滤镜'"
                className="flex-grow border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-pink-500 outline-none"
              />
              <button 
                onClick={handleGenerate}
                disabled={state.isProcessing || !state.originalUrl || !state.prompt}
                className={`px-6 py-2 rounded-lg font-bold text-white transition-all whitespace-nowrap ${
                  state.isProcessing || !state.originalUrl || !state.prompt
                  ? 'bg-slate-300' 
                  : 'bg-pink-600 hover:bg-pink-700 shadow-md'
                }`}
              >
                {state.isProcessing ? '处理中...' : '一键修图'}
              </button>
            </div>
            {state.error && <p className="text-red-500 text-xs mt-2">{state.error}</p>}
          </div>
        </div>

        {/* Output Column */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-96 lg:h-auto flex flex-col relative bg-slate-50 overflow-hidden">
          <div className="absolute top-4 left-4 z-10 bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-slate-600 shadow-sm">效果图</div>
          
          <div className="flex-grow flex items-center justify-center">
             {state.isProcessing ? (
               <div className="text-center">
                 <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mx-auto mb-4"></div>
                 <p className="text-pink-600 font-medium">施展魔法中...</p>
               </div>
             ) : state.generatedUrl ? (
               <img src={state.generatedUrl} alt="Generated" className="w-full h-full object-contain" />
             ) : (
               <p className="text-slate-400 text-sm">处理后的图片将显示在这里</p>
             )}
          </div>

          {state.generatedUrl && (
            <a 
              href={state.generatedUrl} 
              download="magic-edit.png"
              className="mt-4 block w-full text-center py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              保存图片
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoMagic;