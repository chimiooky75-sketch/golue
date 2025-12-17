import React, { useState } from 'react';
import Navigation from './components/Navigation';
import SmartRoute from './components/SmartRoute';
import ItineraryCheck from './components/ItineraryCheck';
import MenuScanner from './components/MenuScanner';
import PhotoMagic from './components/PhotoMagic';
import CommunityHub from './components/CommunityHub';
import NationalGuide from './components/NationalGuide';
import { AppTab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SMART_ROUTE);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.SMART_ROUTE:
        return <SmartRoute />;
      case AppTab.NATIONAL:
        return <NationalGuide />;
      case AppTab.ITINERARY:
        return <ItineraryCheck />;
      case AppTab.MENU_SCANNER:
        return <MenuScanner />;
      case AppTab.PHOTO_MAGIC:
        return <PhotoMagic />;
      case AppTab.COMMUNITY:
        return <CommunityHub />;
      default:
        return <SmartRoute />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar Navigation (Desktop) / Bottom Bar (Mobile) */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden relative">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10 shrink-0">
          <div>
            <h1 className="text-xl font-black text-blue-900 tracking-tight flex items-center">
              <span className="text-2xl mr-2">💣</span>
              旅游排雷工兵
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">厦门版 • MVP</p>
          </div>
          <div className="hidden md:block">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
              Gemini 驱动
            </span>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto h-full">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;