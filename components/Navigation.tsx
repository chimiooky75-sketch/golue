import React from 'react';
import { AppTab } from '../types';

interface NavigationProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: AppTab.SMART_ROUTE, label: '智能路线', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.806-.98l-4.553-2.276M15 7h.01' },
    { id: AppTab.NATIONAL, label: '全国导航', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.29-6.3l1.41-3.54a1 1 0 01.59-.59l3.54-1.41a.5.5 0 01.64.64l-1.41 3.54a1 1 0 01-.59.59l-3.54 1.41a.5.5 0 01-.64-.64z' },
    { id: AppTab.ITINERARY, label: '行程体检', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: AppTab.MENU_SCANNER, label: '菜单扫描', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
    { id: AppTab.PHOTO_MAGIC, label: '魔法修图', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: AppTab.COMMUNITY, label: '社区共建', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 pb-safe z-50 md:relative md:border-t-0 md:bg-transparent md:pb-0 md:w-64 md:flex-shrink-0">
      <div className="flex md:flex-col justify-around md:justify-start md:space-y-2 md:p-4 h-16 md:h-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col md:flex-row items-center justify-center md:justify-start p-2 md:px-4 md:py-3 rounded-xl transition-all ${
              activeTab === tab.id
                ? 'text-blue-600 md:bg-white md:shadow-md'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className="w-6 h-6 mb-1 md:mb-0 md:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            <span className="text-[10px] md:text-sm font-bold">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;