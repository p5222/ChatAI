
import React, { useState, useMemo } from 'react';
import { Chunk, KnowledgeBase, KbType } from '../types.ts';

interface AdminPortalProps {
  chunks: Chunk[];
  onUpdateChunks: (newChunks: Chunk[]) => void;
  onDeleteKb: (fileName: string) => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ chunks, onUpdateChunks, onDeleteKb }) => {
  const [uploadType, setUploadType] = useState<KbType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewingKb, setPreviewingKb] = useState<string | null>(null);

  // 仪表盘统计
  const kbList = useMemo(() => {
    const filesMap: Record<string, KnowledgeBase> = {};
    chunks.forEach(c => {
      if (!filesMap[c.fileName]) {
        filesMap[c.fileName] = {
          fileName: c.fileName,
          version: c.version,
          chunkCount: 0,
          uploadDate: new Date().getFullYear().toString(),
          type: c.type
        };
      }
      filesMap[c.fileName].chunkCount++;
    });
    return Object.values(filesMap);
  }, [chunks]);

  const paramsKbs = kbList.filter(kb => kb.type === 'PARAMS');
  const manualKbs = kbList.filter(kb => kb.type === 'MANUAL');

  /**
   * 深度解析逻辑：确保全量召回与型号锁定
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !uploadType) return;
    setIsProcessing(true);
    
    const newChunks: Chunk[] = [];
    const files = Array.from(e.target.files) as File[];

    for (const file of files) {
      try {
        const text = await file.text();
        const lines = text.split('\n');
        
        let rootModel = ""; // 从文件名提取型号作为兜底
        const fileNameModelMatch = file.name.match(/([a-zA-Z]{1,3}\d{1,4}[a-zA-Z]?)/);
        if (fileNameModelMatch) rootModel = fileNameModelMatch[0];

        let currentContent: string[] = [];
        let currentPath: string[] = [];
        let stack: string[] = [];
        let chunkIndex = 0;
        let lastHeaderModel = ""; // 当前章节识别出的型号

        const pushChunk = () => {
          const contentText = currentContent.join('\n').trim();
          if (contentText.length > 0) {
            const finalPath = currentPath.join(' > ') || '根目录';
            
            // 构造增强型 Context
            // 说明书类型强制锁定型号上下文
            const modelContext = (uploadType === 'MANUAL' && (lastHeaderModel || rootModel)) 
              ? `[型号锁定: ${lastHeaderModel || rootModel}] ` 
              : "";

            newChunks.push({
              id: Math.random().toString(36).substr(2, 9),
              path: finalPath,
              content: modelContext + contentText,
              version: "2025.Q1",
              fileName: file.name,
              type: uploadType,
              index: chunkIndex++
            });
          }
          currentContent = [];
        };

        // 设定切片深度：配置清单通常以一级或二级标题分块，说明书以三级分块
        const targetLevel = uploadType === 'PARAMS' ? 2 : 3;

        lines.forEach((line) => {
          const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
          
          if (headerMatch) {
            const level = headerMatch[1].length;
            const title = headerMatch[2].trim();

            // 尝试从标题中动态更新型号锁定
            const titleModelMatch = title.match(/([a-zA-Z]{1,3}\d{1,4}[a-zA-Z]?)/);
            if (titleModelMatch) lastHeaderModel = titleModelMatch[0];

            if (level <= targetLevel) {
              pushChunk(); // 遇到预设层级标题，切片
              stack = stack.slice(0, level - 1);
              stack[level - 1] = title;
              currentPath = stack.filter(Boolean);
            }
            currentContent.push(line);
          } else {
            // 确保表格行、空行等所有非标题行被无损捕获
            currentContent.push(line);
          }
        });

        // 推入最后一个块
        pushChunk();
      } catch (err) {
        console.error("文件解析异常:", file.name, err);
      }
    }

    onUpdateChunks(newChunks);
    setIsProcessing(false);
    setUploadType(null);
    e.target.value = '';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc]">
      <header className="px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2 rounded-xl">
             <span className="material-symbols-outlined text-primary text-[24px]">account_tree</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none">理邦技术资产管理</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sequential Integrity Engine v12.8</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setUploadType('PARAMS')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-md">
            <span className="material-symbols-outlined text-[18px]">list_alt</span>
            导入配置/参数清单
          </button>
          <button onClick={() => setUploadType('MANUAL')} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-primary-dark transition-all active:scale-95 shadow-md">
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            导入用户说明书
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* 配置参数库 */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
               <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">物理清单资产库 ({paramsKbs.length})</h3>
            </div>
            {paramsKbs.length === 0 ? <EmptyState label="暂无清单数据" /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {paramsKbs.map((kb, idx) => (
                  <KbCard key={idx} kb={kb} onDelete={() => onDeleteKb(kb.fileName)} onPreview={() => setPreviewingKb(kb.fileName)} />
                ))}
              </div>
            )}
          </section>

          {/* 说明书库 */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
               <div className="w-1.5 h-6 bg-primary rounded-full"></div>
               <h3 className="text-sm font-black text-primary uppercase tracking-widest">说明书逻辑分块库 ({manualKbs.length})</h3>
            </div>
            {manualKbs.length === 0 ? <EmptyState label="暂无说明书数据" /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {manualKbs.map((kb, idx) => (
                  <KbCard key={idx} kb={kb} variant="primary" onDelete={() => onDeleteKb(kb.fileName)} onPreview={() => setPreviewingKb(kb.fileName)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 上传模态框 */}
      {uploadType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800">
                 {uploadType === 'PARAMS' ? '导入清单与参数' : '导入逻辑说明书'}
              </h3>
              <button onClick={() => setUploadType(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-8">
              <div className={`border-2 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center relative transition-all ${isProcessing ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/50'}`}>
                {!isProcessing && <input type="file" multiple accept=".md" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isProcessing ? 'bg-primary text-white animate-spin' : 'bg-slate-100 text-slate-400'}`}>
                  <span className="material-symbols-outlined text-3xl">{isProcessing ? 'sync' : 'cloud_upload'}</span>
                </div>
                <p className="font-bold text-slate-800 text-sm">{isProcessing ? '全量深度解析中...' : '点击或拖拽 Markdown 文件'}</p>
                <p className="text-[10px] text-slate-400 mt-2 text-center">系统将锁定型号上下文并保持清单物理顺序。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 数据预览 */}
      {previewingKb && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[700px] bg-white z-[150] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
           <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-lg truncate">切片预览: {previewingKb}</h3>
              <button onClick={() => setPreviewingKb(null)} className="h-10 w-10 rounded-full hover:bg-slate-100 flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
           </div>
           <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6 bg-slate-50/50">
              {chunks.filter(c => c.fileName === previewingKb).sort((a,b) => a.index - b.index).map((chunk, i) => (
                <div key={i} className="p-6 rounded-3xl border bg-white border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{chunk.path}</span>
                    <span className="text-[9px] font-bold text-slate-300">IDX: {chunk.index}</span>
                  </div>
                  <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">{chunk.content}</pre>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="bg-white border border-slate-100 rounded-[2.5rem] py-16 flex flex-col items-center opacity-30">
    <span className="material-symbols-outlined text-5xl mb-4">move_to_inbox</span>
    <p className="text-sm font-bold">{label}</p>
  </div>
);

const KbCard = ({ kb, onDelete, onPreview, variant = 'slate' }: any) => (
  <div className="bg-white border border-slate-200 rounded-[2rem] p-6 relative group hover:shadow-xl transition-all h-full flex flex-col">
    <button onClick={onDelete} className="absolute top-5 right-5 text-slate-200 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-[20px]">delete</span></button>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${variant === 'primary' ? 'bg-primary/10 text-primary' : 'bg-slate-900 text-white'}`}>
      <span className="material-symbols-outlined">{variant === 'primary' ? 'menu_book' : 'list_alt'}</span>
    </div>
    <div className="flex-1">
      <h4 className="font-black text-slate-800 text-sm truncate mb-1" title={kb.fileName}>{kb.fileName}</h4>
      <p className="text-[10px] font-bold text-slate-400 uppercase">{kb.chunkCount} 个切片单元</p>
    </div>
    <button onClick={onPreview} className="mt-4 w-full bg-slate-50 text-slate-500 py-2.5 rounded-xl font-bold text-[10px] hover:bg-slate-100 transition-all uppercase tracking-wider">查看解析明细</button>
  </div>
);

export default AdminPortal;
