import React, { useState, useRef } from 'react';
import { analyzeMenuImage } from '../services/geminiService';
import { MenuAnalysis } from '../types';

const MenuScanner: React.FC = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MenuAnalysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setAnalysis(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!imagePreview) return;
    setLoading(true);
    // Strip header from base64
    const base64Data = imagePreview.split(',')[1];
    
    try {
      const result = await analyzeMenuImage(base64Data);
      setAnalysis(result);
    } catch (error) {
      console.error(error);
      alert("菜单分析失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
        <h2 className="text-2xl font-bold mb-2">菜单隐形坑识别</h2>
        <p className="opacity-90">上传海鲜菜单照片，AI 自动识别“/50g”等价格陷阱。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
        {/* Upload Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center relative">
          {!imagePreview ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-slate-500 mb-4">拍照或上传菜单</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-700 transition"
              >
                选择图片
              </button>
            </div>
          ) : (
            <div className="w-full h-full relative group">
              <img src={imagePreview} alt="Menu" className="w-full h-full object-contain rounded-lg" />
              <button 
                onClick={() => { setImagePreview(null); setAnalysis(null); }}
                className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>

        {/* Analysis Result */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex-grow">
            {!analysis && !loading && (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                上传图片后点击 "扫描菜单"
              </div>
            )}

            {loading && (
              <div className="h-full flex flex-col items-center justify-center">
                 <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                 <p className="text-indigo-600 font-medium animate-pulse">正在识别小字条款...</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-4 animate-fadeIn">
                <div className={`p-4 rounded-lg flex items-center ${
                  analysis.verdict === 'SAFE' ? 'bg-emerald-50 text-emerald-700' :
                  analysis.verdict === 'DANGER' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
                }`}>
                  <span className="text-2xl mr-3">
                    {analysis.verdict === 'SAFE' ? '✅' : analysis.verdict === 'DANGER' ? '🚨' : '⚠️'}
                  </span>
                  <div>
                    <h3 className="font-bold">判定结果: {analysis.verdict === 'SAFE' ? '安全' : analysis.verdict === 'DANGER' ? '高危' : '需谨慎'}</h3>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-2">发现的陷阱:</h4>
                  {analysis.trapsFound.length === 0 ? (
                    <p className="text-slate-500 italic text-sm">暂未发现明显陷阱。</p>
                  ) : (
                    <ul className="space-y-2">
                      {analysis.trapsFound.map((trap, i) => (
                        <li key={i} className="flex items-start text-sm text-red-600 bg-red-50 p-2 rounded">
                          <span className="mr-2">•</span> {trap}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-100">
                  <span className="font-bold block mb-1">AI 解析:</span>
                  {analysis.explanation}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleScan}
            disabled={!imagePreview || loading}
            className={`w-full py-3 mt-4 rounded-lg font-bold text-white transition-all ${
              !imagePreview || loading 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
            }`}
          >
            扫描菜单
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuScanner;