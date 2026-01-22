
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const rewriteQuery = async (query: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `分析用户意图，识别核心型号（如 iV100, CX10）和类别标签 ([CONFIG], [SPEC], [MANUAL])。输入：${query}`;
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
    const isConfig = cleanQuery.includes('config');
    const isSpec = cleanQuery.includes('spec');
    const isManual = cleanQuery.includes('manual');
    
    const kws = cleanQuery.split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/).filter(k => k.length >= 1);
    
    const configBuckets: Set<string> = new Set();
    const specBuckets: Set<string> = new Set();
    const manualBuckets: Set<string> = new Set();
    const sources: Set<string> = new Set();

    const scoredChunks = chunks.map(chunk => {
      let score = 0;
      const content = chunk.content.toLowerCase();
      const path = chunk.path.toLowerCase();
      const fileName = chunk.fileName.toLowerCase();

      kws.forEach(kw => {
        if (path.includes(kw) || fileName.includes(kw) || content.includes(`型号锁定: ${kw}`)) score += 60000;
        if (content.includes(kw)) score += 5000;
      });

      if (chunk.type === 'PARAMS') {
        if (isConfig && /(清单|配件|标配|装箱)/.test(content)) score += 40000;
        if (isSpec && /(规格|参数|范围|精度|性能)/.test(content)) score += 40000;
      } else if (isManual && isManual) {
        score += 30000;
      }

      return { ...chunk, score };
    });

    const topHits = scoredChunks.filter(s => s.score > 20000).sort((a, b) => b.score - a.score).slice(0, 15);
    const uniquePaths = new Set<string>(topHits.map(h => `${h.fileName}|${h.path}`));

    for (const pathKey of uniquePaths) {
      const [fName, fPath] = pathKey.split('|');
      sources.add(`${fName} > ${fPath}`);
      
      const fullContent = chunks
        .filter(c => c.fileName === fName && c.path === fPath)
        .sort((a, b) => a.index - b.index)
        .map(c => c.content)
        .join('\n');

      const meta = `[来源: ${fName}] [路径: ${fPath}]`;
      const combined = `${meta}\n${fullContent}`;

      const lower = fullContent.toLowerCase();
      if (/(清单|配件|标配)/.test(lower)) {
        configBuckets.add(combined);
      } else if (/(参数|规格|范围)/.test(lower)) {
        specBuckets.add(combined);
      } else {
        manualBuckets.add(combined);
      }
    }

    return {
      config: Array.from(configBuckets).join('\n\n---\n\n'),
      spec: Array.from(specBuckets).join('\n\n---\n\n'),
      manual: Array.from(manualBuckets).join('\n\n---\n\n'),
      sourceList: Array.from(sources)
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date().toLocaleTimeString() }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const analysis = await rewriteQuery(input);
      const data = searchKnowledgeBase(analysis);
      
      const systemInstruction = `
# Role
你是一个理邦仪器 (Edan) 官方高级技术数据对齐接口。

# 核心指令
1. **全量顺序对齐**：必须按照 Context 中的物理顺序输出，严禁对配置清单、参数清单或说明书章节进行跳号、摘要或截断。
2. **严禁混淆**：配置清单(CONFIG)属于配件资产，技术参数(SPEC)属于性能规格。不要将参数数据填入配置表格。

# 输出规范
- **配置清单**：标题 ### 【型号 配置清单】。表格必须为 4 列：| 序号 | 配件名称 | 数量 | 规格/备注 |。
- **技术参数**：标题 ### 【型号 技术参数】。表格必须为 4 列：| 序号 | 参数分类 | 参数子项 | 规格数值 |。
- **说明书回答**：基于[确认性结论] -> [具体步骤/表格] 的结构。

# Context Data
## [配置清单库]
${data?.config || '未匹配到相关配件清单数据'}

## [技术参数库]
${data?.spec || '未匹配到相关技术规格数据'}

## [用户说明书库]
${data?.manual || '未匹配到相关操作指引数据'}

请直接输出结果，严禁任何废话。
`;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: `用户查询: ${input} (解析: ${analysis})`,
        config: { systemInstruction, temperature: 0.0 } 
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

      // 追溯溯源信息 - 严格追加在底部
      if (data?.sourceList && data.sourceList.length > 0) {
        const sourceMarkdown = `\n\n---\n**知识库溯源：**\n${data.sourceList.map(s => `> 🔍 ${s}`).join('\n')}`;
        fullContent += sourceMarkdown;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: fullContent }];
          }
          return prev;
        });
      }

      onNewLog({ 
        timestamp: new Date().toLocaleString(), 
        user: "User", 
        query: input, 
        response: fullContent, 
        confidence: 100 
      });

    } catch (error) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: '服务响应异常，请重新尝试。' }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc]">
      <header className="h-16 w-full flex items-center px-8 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
           <div className={`w-2.5 h-2.5 rounded-full ${chunks.length > 0 ? 'bg-primary shadow-[0_0_12px_rgba(13,121,145,0.5)]' : 'bg-slate-300'}`} />
           <span className="text-[11px] font-black text-slate-500 tracking-widest uppercase">
             EDAN INTELLIGENCE ENGINE v12.8
           </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-6 md:p-12 w-full max-w-5xl mx-auto overflow-y-auto custom-scrollbar" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-40 opacity-30 text-center">
            <div className="h-32 w-32 rounded-[3.5rem] bg-primary/10 flex items-center justify-center text-primary mb-8 shadow-inner">
              <span className="material-symbols-outlined text-[64px]">list_alt</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">理邦技术资产智能对齐</h2>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.5em] text-slate-400">已开启全量物理顺序还原检索</p>
          </div>
        ) : (
          <div className="space-y-16 pb-32">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-5 duration-500`}>
                <div className={`flex gap-6 max-w-[100%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`shrink-0 h-12 w-12 rounded-[1.4rem] flex items-center justify-center text-[12px] font-black shadow-xl ${m.role === 'user' ? 'bg-[#111827] text-white' : 'bg-[#0d7991] text-white'}`}>
                    {m.role === 'user' ? 'USR' : 'EDN'}
                  </div>
                  <div className={`p-8 md:p-10 rounded-[2.5rem] border transition-all bg-white text-slate-800 shadow-sm hover:shadow-md ${m.role === 'user' ? 'rounded-tr-none border-slate-300' : 'rounded-tl-none border-[#0d7991]/20'}`}>
                    <div 
                      className="text-[14px] leading-relaxed prose prose-slate max-w-none markdown-content"
                      dangerouslySetInnerHTML={{ __html: marked.parse(m.content || (isLoading && i === messages.length - 1 ? '正在全量对齐物理数据源...' : '')) }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl mx-auto px-6 pb-12">
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 p-6 flex items-end transition-all focus-within:shadow-primary/10">
          <textarea 
            className="flex-1 bg-transparent border-0 focus:ring-0 text-sm py-5 px-6 resize-none min-h-[64px] max-h-56 custom-scrollbar font-medium placeholder:text-slate-300" 
            placeholder="查询型号标配清单、技术参数或操作指引..." 
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
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`h-16 w-16 rounded-[2.5rem] flex items-center justify-center transition-all ${isLoading || !input.trim() ? 'bg-slate-50 text-slate-200' : 'bg-[#0d7991] text-white shadow-2xl active:scale-90 hover:brightness-110'}`}
          >
            <span className="material-symbols-outlined text-[36px]">{isLoading ? 'sync' : 'arrow_upward'}</span>
          </button>
        </div>
        <div className="flex justify-center gap-10 mt-8">
           {['iV100标配清单', 'CX10技术参数', 'iX10语言设置对比'].map(tag => (
             <button key={tag} onClick={() => setInput(tag)} className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-primary transition-colors">#{tag}</button>
           ))}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
