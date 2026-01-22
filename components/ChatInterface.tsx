
import { GenerateContentResponse, GoogleGenAI } from "@google/genai";
import { marked } from "marked";
import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, Chunk } from '../types.ts';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onNewLog: (log: any) => void;
  chunks: Chunk[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, setMessages, onNewLog, chunks }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const rewriteQuery = async (query: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `分析用户意图，识别核心型号和类别标签。输入：${query}`;
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { temperature: 0.1 }
      });
      return result.text?.trim() || query;
    } catch (e) {
      return query;
    }
  };

  const searchKnowledgeBase = (rewrittenQuery: string) => {
    if (!chunks || chunks.length === 0) return null;
    const cleanQuery = rewrittenQuery.toLowerCase();
    const kws = cleanQuery.split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/).filter(k => k.length >= 1);
    
    const configBuckets: Set<string> = new Set();
    const specBuckets: Set<string> = new Set();
    const manualBuckets: Set<string> = new Set();
    const sources: Set<string> = new Set();

    const scoredChunks = chunks.map(chunk => {
      let score = 0;
      const content = chunk.content.toLowerCase();
      kws.forEach(kw => {
        if (content.includes(kw)) score += 5000;
      });
      return { ...chunk, score };
    });

    const topHits = scoredChunks.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
    
    topHits.forEach(h => {
      sources.add(`${h.fileName} > ${h.path}`);
      const combined = `[来源: ${h.fileName}] [路径: ${h.path}]\n${h.content}`;
      if (/(清单|配件|标配)/.test(h.content)) configBuckets.add(combined);
      else if (/(参数|规格|范围)/.test(h.content)) specBuckets.add(combined);
      else manualBuckets.add(combined);
    });

    return {
      config: Array.from(configBuckets).join('\n\n---\n\n'),
      spec: Array.from(specBuckets).join('\n\n---\n\n'),
      manual: Array.from(manualBuckets).join('\n\n---\n\n'),
      sourceList: Array.from(sources)
    };
  };

  const handleSend = async (retryQuery?: string) => {
    const queryToUse = retryQuery || input;
    if (!queryToUse.trim() || isLoading) return;

    if (!retryQuery) {
      const userMsg: ChatMessage = { role: 'user', content: queryToUse, timestamp: new Date().toLocaleTimeString() };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setLastQuery(queryToUse);
    } else {
      // 如果是重试，移除最后一条错误的回复
      setMessages(prev => prev.slice(0, -1));
    }

    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date().toLocaleTimeString() }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const analysis = await rewriteQuery(queryToUse);
      const data = searchKnowledgeBase(analysis);
      
      const systemInstruction = `你是理邦仪器官方技术助手。直接输出结构化数据。
配置清单表格：| 序号 | 配件名称 | 数量 | 备注 |
技术参数表格：| 序号 | 参数分类 | 参数子项 | 规格数值 |
上下文：${JSON.stringify(data)}`;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: queryToUse,
        config: { systemInstruction, temperature: 0.1 } 
      });

      let fullContent = '';
      for await (const chunk of responseStream) {
        const text = (chunk as GenerateContentResponse).text;
        if (text) {
          fullContent += text;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: fullContent }];
            }
            return prev;
          });
        }
      }

      if (data?.sourceList?.length) {
        fullContent += `\n\n---\n**知识库溯源：**\n${data.sourceList.map(s => `> 🔍 ${s}`).join('\n')}`;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: fullContent }];
        });
      }

    } catch (error: any) {
      console.error("API Error:", error);
      let errorMsg = '服务响应异常，请重新尝试。';
      if (error.message?.includes('429')) errorMsg = '请求过于频繁，请稍后再试。';
      if (error.message?.includes('401')) errorMsg = 'API Key 无效或未配置，请检查设置。';
      
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: errorMsg }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f8f9]">
      {/* 顶部状态栏 */}
      <header className="h-14 w-full flex items-center justify-between px-6 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             System Status: Online
           </span>
        </div>
      </header>

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-8 md:px-12" ref={scrollRef}>
        <div className="max-w-4xl mx-auto space-y-12">
          {messages.length === 0 ? (
            <div className="py-20 text-center animate-in fade-in zoom-in duration-700">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-white shadow-xl border border-slate-100 mb-6">
                <span className="material-symbols-outlined text-primary text-4xl">psychology</span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">您好，我是理邦智能助手</h2>
              <p className="text-sm text-slate-400 mt-2">您可以查询设备标配、技术参数或查阅操作说明</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex w-full group ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* 头像 */}
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black shadow-lg transition-transform group-hover:scale-110 ${
                    m.role === 'user' ? 'bg-[#0f172a] text-white' : 'bg-[#0d7991] text-white'
                  }`}>
                    {m.role === 'user' ? 'USR' : 'EDN'}
                  </div>
                  
                  {/* 气泡 */}
                  <div className="flex flex-col gap-2">
                    <div className={`px-6 py-5 shadow-sm border border-slate-200/50 bg-white text-slate-700 ${
                      m.role === 'user' 
                        ? 'rounded-[30px_30px_4px_30px]' 
                        : 'rounded-[30px_30px_30px_4px]'
                    }`}>
                      {m.content === '服务响应异常，请重新尝试。' ? (
                        <div className="flex flex-col items-center gap-4 py-2">
                           <div className="flex items-center gap-2 text-red-500 font-bold">
                             <span className="material-symbols-outlined text-[20px]">error</span>
                             <span>服务响应异常</span>
                           </div>
                           <button 
                             onClick={() => handleSend(lastQuery)}
                             className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-md"
                           >
                             <span className="material-symbols-outlined text-[16px]">refresh</span>
                             重新尝试
                           </button>
                        </div>
                      ) : (
                        <div 
                          className="text-[14px] leading-[1.8] prose prose-slate max-w-none markdown-content font-medium"
                          dangerouslySetInnerHTML={{ __html: marked.parse(m.content || (isLoading && i === messages.length - 1 ? '数据深度对齐中...' : '')) }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase px-4">
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="p-6 bg-gradient-to-t from-white via-white/80 to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-200 p-2 flex items-center transition-all focus-within:ring-2 ring-primary/10">
            <textarea 
              className="flex-1 bg-transparent border-0 focus:ring-0 text-[14px] font-medium py-4 px-6 resize-none min-h-[56px] max-h-40 custom-scrollbar placeholder:text-slate-300" 
              placeholder="请输入您的问题..." 
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button 
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
                isLoading || !input.trim() 
                  ? 'bg-slate-50 text-slate-300' 
                  : 'bg-[#0d7991] text-white shadow-lg shadow-primary/20 hover:brightness-110 active:scale-90'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">
                {isLoading ? 'hourglass_bottom' : 'send'}
              </span>
            </button>
          </div>
          <div className="flex justify-center gap-6 mt-4">
             {['iV100 标配', 'CX10 技术参数'].map(tag => (
               <button 
                 key={tag} 
                 onClick={() => setInput(tag)} 
                 className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-primary transition-colors"
               >
                 #{tag}
               </button>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
