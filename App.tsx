
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.tsx';
import ChatInterface from './components/ChatInterface.tsx';
import AdminPortal from './components/AdminPortal.tsx';
import AnalyticsDashboard from './components/AnalyticsDashboard.tsx';
import { ViewType, InteractionLog, ChatMessage, Chunk } from './types.ts';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.CHAT);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<InteractionLog[]>([]);
  const [allChunks, setAllChunks] = useState<Chunk[]>([]);

  // 1. 初始化加载
  useEffect(() => {
    const savedLogs = localStorage.getItem('medai_logs');
    if (savedLogs) setLogs(JSON.parse(savedLogs));

    const savedChat = localStorage.getItem('medai_chat_history');
    if (savedChat) setMessages(JSON.parse(savedChat));

    const savedChunks = localStorage.getItem('medai_knowledge_base');
    if (savedChunks) setAllChunks(JSON.parse(savedChunks));
  }, []);

  // 2. 状态持久化
  useEffect(() => {
    localStorage.setItem('medai_knowledge_base', JSON.stringify(allChunks));
  }, [allChunks]);

  useEffect(() => {
    localStorage.setItem('medai_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('medai_logs', JSON.stringify(logs));
  }, [logs]);

  const addLog = (log: Omit<InteractionLog, 'id'>) => {
    const newLog = { ...log, id: Math.random().toString(36).substr(2, 9) };
    setLogs(prev => [newLog, ...prev]);
  };

  const clearChat = () => {
    if (window.confirm('确定要清空所有对话记录吗？')) {
      setMessages([]);
      localStorage.removeItem('medai_chat_history');
    }
  };

  const clearLogs = () => {
    if (window.confirm('确定要清除所有系统审计日志吗？')) {
      setLogs([]);
      localStorage.removeItem('medai_logs');
    }
  };

  const deleteKb = (fileName: string) => {
    const filtered = allChunks.filter(c => c.fileName !== fileName);
    setAllChunks(filtered);
  };

  const updateChunks = (newChunks: Chunk[]) => {
    setAllChunks(prev => [...prev, ...newChunks]);
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light">
      <Sidebar 
        currentView={currentView} 
        onViewChange={handleViewChange} 
        onClearChat={clearChat}
      />
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {currentView === ViewType.CHAT && (
          <ChatInterface messages={messages} setMessages={setMessages} onNewLog={addLog} chunks={allChunks} />
        )}
        {currentView === ViewType.ADMIN && (
          <AdminPortal chunks={allChunks} onUpdateChunks={updateChunks} onDeleteKb={deleteKb} />
        )}
        {currentView === ViewType.ANALYTICS && (
          <AnalyticsDashboard logs={logs} onClearLogs={clearLogs} />
        )}
      </main>
    </div>
  );
};

export default App;
