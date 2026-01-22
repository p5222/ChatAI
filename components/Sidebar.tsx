
import React from 'react';
import { ViewType } from '../types.ts';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onClearChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onClearChat }) => {
  return (
    <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-20">
      <div className="p-6 pb-4">
        {/* Logo 区域 - 移除 hub 标识 */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex flex-col">
            <h1 className="font-extrabold text-[#111718] text-[15px] leading-tight">理邦仪器知识助手</h1>
            <div className="mt-0.5">
              <span className="text-[9px] font-black text-[#0d7991] bg-[#e0f2f5] px-1.5 py-0.5 rounded-sm uppercase tracking-wider">ENTERPRISE</span>
            </div>
          </div>
        </div>

        {/* 核心对话按钮 - 移除 chat 文字 */}
        <button 
          onClick={() => onViewChange(ViewType.CHAT)}
          className="w-full flex items-center justify-center gap-2 bg-[#0d7991] hover:bg-[#0a5d70] text-white py-3 px-4 rounded-lg transition-all shadow-sm active:scale-[0.98] mb-10"
        >
          <span className="font-bold text-[14px]">进入智能对话</span>
        </button>

        {/* 导航分组 */}
        <div className="space-y-8">
          <div>
            <h3 className="text-[12px] font-bold text-slate-400 mb-4 px-1">管理控制台</h3>
            <div className="space-y-1">
              <NavItem 
                icon="database" 
                label="知识库管理" 
                active={currentView === ViewType.ADMIN} 
                onClick={() => onViewChange(ViewType.ADMIN)} 
              />
              <NavItem 
                icon="query_stats" 
                label="性能数据分析" 
                active={currentView === ViewType.ANALYTICS} 
                onClick={() => onViewChange(ViewType.ANALYTICS)} 
              />
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-bold text-slate-400 mb-4 px-1">系统工具</h3>
            <div className="space-y-1">
              <button 
                onClick={onClearChat}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-red-50 text-[#ef4444] transition-all text-left group"
              >
                <span className="material-symbols-outlined text-[22px]">delete_sweep</span>
                <span className="text-[14px] font-medium">清空所有对话历史</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-slate-100">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-[#0d7991] shadow-[0_0_8px_rgba(13,121,145,0.4)]"></div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">EDAN INTELLIGENCE ACTIVE</span>
        </div>
      </div>
    </aside>
  );
};

const NavItem: React.FC<{ icon: string; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-all text-left group ${active ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
  >
    <span className={`material-symbols-outlined text-[22px] ${active ? 'text-[#475569]' : 'text-[#94a3b8] group-hover:text-[#475569]'}`}>{icon}</span>
    <span className={`text-[14px] ${active ? 'font-bold text-[#334155]' : 'font-medium text-[#64748b]'}`}>{label}</span>
  </button>
);

export default Sidebar;
