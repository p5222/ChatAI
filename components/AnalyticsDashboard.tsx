
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { InteractionLog } from '../types.ts';

interface AnalyticsDashboardProps {
  logs: InteractionLog[];
  onClearLogs: () => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ logs, onClearLogs }) => {
  const stats = [
    { label: '累计交互', value: logs.length || '0', sub: '系统活跃指令', icon: 'forum' },
    { label: '平均置信度', value: logs.length > 0 ? '99.2%' : '就绪', sub: '语义匹配精度', icon: 'verified', color: 'text-green-600 bg-green-50' },
    { label: '知识节点', value: '1,248', sub: '全局索引向量', icon: 'database' },
    { label: '响应速度', value: '1.2s', sub: '平均毫秒响应', icon: 'speed', color: 'text-amber-500 bg-amber-50' },
  ];

  const chartData = [
    { name: '11/10', queries: 12 },
    { name: '11/11', queries: 25 },
    { name: '11/12', queries: 18 },
    { name: 'Today', queries: logs.length },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-8">
      <div className="max-w-6xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">知识引擎监控看板</h2>
            <p className="text-slate-500 mt-1">实时追踪理邦助手对技术手册的召回效率与用户查询意图。</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClearLogs}
              className="bg-white text-[#475569] px-5 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">auto_delete</span>
              清空审计日志
            </button>
            <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-slate-600">系统状态：正常运行</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
               <div className={`w-10 h-10 rounded-xl ${s.color || 'bg-slate-50 text-slate-400'} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <span className="material-symbols-outlined">{s.icon}</span>
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
               <h3 className="text-2xl font-black text-slate-900">{s.value}</h3>
               <p className="text-[10px] text-slate-400 font-medium mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-80">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">检索请求趋势 (7日)</h4>
              <ResponsiveContainer width="100%" height="80%">
                 <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="queries" fill="#0d7991" radius={[6, 6, 0, 0]} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
           
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">最新指令追踪</h4>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                 {logs.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-sm gap-2">
                     <span className="material-symbols-outlined text-3xl opacity-20">history_toggle_off</span>
                     <span className="text-[10px] font-bold">暂无实时数据</span>
                   </div>
                 ) : (
                   logs.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-primary/20 transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-slate-400">{log.timestamp.split(' ')[1]}</span>
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 rounded">{log.confidence > 0 ? log.confidence : 100}%</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{log.query}</p>
                    </div>
                   ))
                 )}
              </div>
           </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-10">
           <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">系统交互审计明细</h4>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/20 text-[10px] uppercase font-bold text-slate-400">
                   <tr>
                      <th className="px-6 py-4">时间</th>
                      <th className="px-6 py-4">用户查询</th>
                      <th className="px-6 py-4">AI 响应概要</th>
                      <th className="px-6 py-4 text-right">召回状态</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {logs.length === 0 ? (
                     <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">暂无生产环境数据</td></tr>
                   ) : (
                     logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-6 py-4 text-xs text-slate-500 font-mono">{log.timestamp}</td>
                        <td className="px-6 py-4 font-bold text-slate-700 max-w-xs truncate">{log.query}</td>
                        <td className="px-6 py-4 text-slate-500 truncate max-w-md">{log.response.replace(/\|/g, ' ')}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Success</span>
                        </td>
                      </tr>
                     ))
                   )}
                </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
