import React, { useState, useEffect } from 'react';
import { zoneService } from '../services/zoneService';
import { ZoneSubmission } from '../types';

const CommunityHub: React.FC = () => {
  const [submissions, setSubmissions] = useState<ZoneSubmission[]>([]);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = () => {
    setSubmissions(zoneService.getPendingSubmissions());
  };

  const handleModerate = (id: string, action: 'APPROVE' | 'REJECT') => {
    zoneService.moderateSubmission(id, action);
    loadSubmissions(); // Refresh list
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-gradient-to-r from-orange-400 to-pink-500 p-6 rounded-xl shadow-lg text-white">
        <h2 className="text-2xl font-bold mb-2">社区守护者</h2>
        <p className="opacity-90">审核其他旅行者的爆料，帮助大家避雷。</p>
      </div>

      <div className="flex-grow bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-700">待审核列表 ({submissions.length})</h3>
          <button onClick={loadSubmissions} className="text-blue-600 text-xs font-semibold hover:underline">刷新</button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 flex-grow">
          {submissions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p>全部审核完毕！</p>
            </div>
          ) : (
            submissions.map((sub) => (
              <div key={sub.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-slate-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${sub.type === 'RED' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                    <h4 className="font-bold text-slate-800 text-lg">{sub.name}</h4>
                  </div>
                  <span className="text-xs text-slate-400">{new Date(sub.submittedAt).toLocaleDateString()}</span>
                </div>
                
                <p className="text-slate-600 text-sm mb-4 bg-white p-3 rounded border border-slate-100 italic">
                  "{sub.description}"
                </p>

                <div className="flex gap-3">
                  <button 
                    onClick={() => handleModerate(sub.id, 'APPROVE')}
                    className="flex-1 bg-emerald-100 text-emerald-700 py-2 rounded-lg font-bold text-sm hover:bg-emerald-200 transition flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    通过
                  </button>
                  <button 
                    onClick={() => handleModerate(sub.id, 'REJECT')}
                    className="flex-1 bg-red-100 text-red-700 py-2 rounded-lg font-bold text-sm hover:bg-red-200 transition flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    驳回
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityHub;