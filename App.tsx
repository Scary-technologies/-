
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FamilyMember, AppTheme } from './types';
import FamilyTree from './components/FamilyTree';
import MemberPanel from './components/MemberPanel';
import { Menu, X, Search, Download, Upload, Palette, Maximize, Minimize, Save, Cloud, CheckCircle2, RefreshCcw } from 'lucide-react';

// Historical Context Data (Persian/World History)
const historicalEvents = [
    { year: 1285, title: 'امضای فرمان مشروطیت' },
    { year: 1299, title: 'کودتای ۳ اسفند' },
    { year: 1304, title: 'تاسیس سلسله پهلوی' },
    { year: 1320, title: 'اشغال ایران در جنگ جهانی دوم' },
    { year: 1329, title: 'ملی شدن صنعت نفت' },
    { year: 1357, title: 'پیروزی انقلاب اسلامی' },
    { year: 1359, title: 'آغاز جنگ تحمیلی' },
    { year: 1367, title: 'پایان جنگ تحمیلی' },
];

// --- Complex Initial Data (Default Factory Settings) ---
const defaultFamilyData: FamilyMember = {
  id: 'system_root',
  name: 'ریشه سیستم',
  relation: 'SystemRoot',
  gender: 'male',
  children: [
    {
      id: 'root_1',
      name: 'بزرگ‌خاندان',
      relation: 'Root',
      gender: 'male',
      code: 'A10001',
      birthDate: '1300',
      location: 'تهران',
      bio: 'سر سلسله خاندان...',
      children: []
    }
  ]
};

// Helper to generate unique 6-char code
const generateUniqueCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const STORAGE_KEY = 'nasab_family_tree_autosave';

const App: React.FC = () => {
  const [treeData, setTreeData] = useState<FamilyMember>(defaultFamilyData);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [theme, setTheme] = useState<AppTheme>('modern');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme to body class
  useEffect(() => {
      document.body.className = `theme-${theme}`;
  }, [theme]);

  // --- AUTO LOAD ---
  useEffect(() => {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
          try {
              const parsed = JSON.parse(savedData);
              if (parsed && (parsed.id || parsed.children)) {
                  setTreeData(parsed);
                  console.log('Auto-loaded from local storage');
              }
          } catch (e) {
              console.error('Failed to auto-load', e);
          }
      }
  }, []);

  // --- AUTO SAVE ---
  useEffect(() => {
      setSaveStatus('saving');
      const timer = setTimeout(() => {
          try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(treeData));
              setSaveStatus('saved');
          } catch (e) {
              setSaveStatus('unsaved');
              console.error('Auto-save failed', e);
          }
      }, 1000); // Debounce save by 1 second

      return () => clearTimeout(timer);
  }, [treeData]);

  // Recursive helpers
  const findNode = useCallback((node: FamilyMember, id: string): FamilyMember | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  }, []);
  
  const findParent = useCallback((root: FamilyMember, targetId: string): FamilyMember | null => {
    if (root.children) {
      for (const child of root.children) {
        if (child.id === targetId) return root;
        const found = findParent(child, targetId);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const updateNode = (node: FamilyMember, updated: FamilyMember): FamilyMember => {
    if (node.id === updated.id) return updated;
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => updateNode(child, updated))
      };
    }
    return node;
  };

  const addChildNode = (node: FamilyMember, parentId: string): FamilyMember => {
    if (node.id === parentId) {
      const newChild: FamilyMember = {
        id: Date.now().toString(),
        name: 'فرزند جدید',
        gender: 'male',
        relation: 'Child',
        code: generateUniqueCode(),
        children: []
      };
      return {
        ...node,
        children: [...(node.children || []), newChild]
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => addChildNode(child, parentId))
      };
    }
    return node;
  };

  const addSiblingNode = (root: FamilyMember, siblingId: string): FamilyMember => {
    if (root.id === siblingId) {
      alert("نمی‌توانید برای ریشه اصلی، هم‌سطح ایجاد کنید.");
      return root;
    }
    const parent = findParent(root, siblingId);
    if (parent) {
       return addChildNode(root, parent.id);
    }
    return root;
  };

  const addParentToRoot = (currentRoot: FamilyMember) => {
      if (currentRoot.relation === 'SystemRoot') {
           const newClanRoot: FamilyMember = {
              id: Date.now().toString(),
              name: 'سرشاخه جدید',
              gender: 'male',
              relation: 'Root',
              code: generateUniqueCode(),
              children: []
          };
          const newTree = {
              ...currentRoot,
              children: [...(currentRoot.children || []), newClanRoot]
          };
          setTreeData(newTree);
          return;
      }
      const newRoot: FamilyMember = {
        id: Date.now().toString(),
        name: 'بزرگ‌خاندان (جدید)',
        gender: 'male',
        relation: 'Root',
        code: generateUniqueCode(),
        children: [currentRoot]
      };
      setTreeData(newRoot);
  };

  const deleteNode = (node: FamilyMember, idToDelete: string): FamilyMember | null => {
    if (node.id === idToDelete) return null;
    if (node.children) {
      return {
        ...node,
        children: node.children
          .map(child => deleteNode(child, idToDelete))
          .filter((child): child is FamilyMember => child !== null)
      };
    }
    return node;
  };

  const addConnectionNode = (node: FamilyMember, sourceId: string, targetId: string, label: string): FamilyMember => {
    if (node.id === sourceId) {
      const existing = node.connections || [];
      if (existing.some(c => c.targetId === targetId)) return node;
      return { ...node, connections: [...existing, { targetId, label }] };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => addConnectionNode(child, sourceId, targetId, label))
      };
    }
    return node;
  };

  const removeConnectionNode = (node: FamilyMember, sourceId: string, targetId: string): FamilyMember => {
    if (node.id === sourceId && node.connections) {
      return {
        ...node,
        connections: node.connections.filter(c => c.targetId !== targetId)
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => removeConnectionNode(child, sourceId, targetId))
      };
    }
    return node;
  };

  const handleAddSpouse = (memberId: string, existingSpouseId?: string) => {
      if (existingSpouseId) {
          let newTree = addConnectionNode(treeData, memberId, existingSpouseId, 'همسر');
          newTree = addConnectionNode(newTree, existingSpouseId, memberId, 'همسر');
          setTreeData(newTree);
          alert("ازدواج فامیلی ثبت شد.");
      } else {
          const member = findNode(treeData, memberId);
          const spouseGender = member?.gender === 'male' ? 'female' : 'male';
          const spouseName = member?.gender === 'male' ? 'همسر (خانم)' : 'همسر (آقا)';
          
          const newSpouse: FamilyMember = {
              id: Date.now().toString(),
              name: spouseName,
              gender: spouseGender,
              relation: 'Spouse',
              code: generateUniqueCode(),
              children: [] 
          };

          let newTree = treeData;
          if (treeData.relation === 'SystemRoot') {
               newTree = {
                   ...treeData,
                   children: [...(treeData.children || []), newSpouse]
               };
          } else {
              newTree = {
                  id: 'system_root_auto',
                  relation: 'SystemRoot',
                  name: 'System',
                  gender: 'male',
                  children: [treeData, newSpouse]
              };
          }
          newTree = addConnectionNode(newTree, memberId, newSpouse.id, 'همسر');
          newTree = addConnectionNode(newTree, newSpouse.id, memberId, 'همسر');
          setTreeData(newTree);
      }
  };

  const flattenTree = (node: FamilyMember): FamilyMember[] => {
    let list = [node];
    if (node.children) {
      node.children.forEach(child => {
        list = [...list, ...flattenTree(child)];
      });
    }
    return list;
  };

  const allMembers = useMemo(() => flattenTree(treeData), [treeData]);

  const getPathToRoot = (root: FamilyMember, targetId: string): FamilyMember[] | null => {
    if (root.id === targetId) return [root];
    if (root.children) {
      for (const child of root.children) {
        const path = getPathToRoot(child, targetId);
        if (path) return [root, ...path];
      }
    }
    return null;
  };

  const calculateRelationship = (id1: string, id2: string): string => {
    if (id1 === id2) return "خود شخص";
    const member1 = findNode(treeData, id1);
    const member2 = findNode(treeData, id2);
    if (!member1 || !member2) return "فرد یافت نشد";

    if (member1.connections?.some(c => c.targetId === id2 && c.label.includes('همسر'))) return "همسر";
    if (member2.connections?.some(c => c.targetId === id1 && c.label.includes('همسر'))) return "همسر";

    const path1 = getPathToRoot(treeData, id1);
    const path2 = getPathToRoot(treeData, id2);

    if (!path1 || !path2 || path1[0].id !== path2[0].id) {
        return "ارتباط خونی مستقیم یافت نشد";
    }

    let lcaIndex = 0;
    while (
        lcaIndex < path1.length && 
        lcaIndex < path2.length && 
        path1[lcaIndex].id === path2[lcaIndex].id
    ) {
        lcaIndex++;
    }
    lcaIndex--; 
    
    const d1 = path1.length - 1 - lcaIndex;
    const d2 = path2.length - 1 - lcaIndex;
    const gender2 = member2.gender;

    if (d1 === 0) {
        if (d2 === 1) return gender2 === 'male' ? "فرزند (پسر)" : "فرزند (دختر)";
        if (d2 === 2) return gender2 === 'male' ? "نوه (پسر)" : "نوه (دختر)";
        return `نواده (${d2} نسل بعد)`;
    }
    if (d2 === 0) {
        if (d1 === 1) return gender2 === 'male' ? "پدر" : "مادر";
        if (d1 === 2) return gender2 === 'male' ? "پدربزرگ" : "مادربزرگ";
        return `جد (${d1} نسل قبل)`;
    }

    if (d1 === 1 && d2 === 1) return gender2 === 'male' ? "برادر" : "خواهر";

    if (d1 === 1 && d2 === 2) {
        const m2Parent = path2[path2.length - 2];
        const relationType = m2Parent.gender === 'male' ? "برادر" : "خواهر";
        return gender2 === 'male' ? `پسر ${relationType}` : `دختر ${relationType}`;
    }
    if (d1 === 2 && d2 === 1) {
        const m1Parent = path1[path1.length - 2];
        if (m1Parent.gender === 'male') return gender2 === 'male' ? "عمو" : "عمه";
        return gender2 === 'male' ? "دایی" : "خاله";
    }

    if (d1 === 2 && d2 === 2) {
        const m1Parent = path1[path1.length - 2];
        const m2Parent = path2[path2.length - 2];
        if (m1Parent.gender === 'male') {
            if (m2Parent.gender === 'male') return gender2 === 'male' ? "پسرعمو" : "دخترعمو";
            else return gender2 === 'male' ? "پسرعمه" : "دخترعمه";
        } else {
            if (m2Parent.gender === 'male') return gender2 === 'male' ? "پسردایی" : "دختردایی";
            else return gender2 === 'male' ? "پسرخاله" : "دخترخاله";
        }
    }

    return `ارتباط فامیلی دور (فاصله ${d1} - ${d2})`;
  };

  const handleHighlightPath = (memberId: string, direction: 'ancestors' | 'descendants' | 'reset') => {
      if (direction === 'reset') { setHighlightedIds(new Set()); return; }
      const idsToHighlight = new Set<string>();
      idsToHighlight.add(memberId);
      if (direction === 'ancestors') {
          const path = getPathToRoot(treeData, memberId);
          if (path) path.forEach(p => idsToHighlight.add(p.id));
      } else if (direction === 'descendants') {
          const collectDescendants = (node: FamilyMember) => {
              idsToHighlight.add(node.id);
              if (node.children) node.children.forEach(collectDescendants);
          };
          const node = findNode(treeData, memberId);
          if (node) collectDescendants(node);
      }
      setHighlightedIds(idsToHighlight);
  };

  const handleNodeClick = useCallback((member: FamilyMember) => {
    setSelectedMember(member);
    setIsPanelOpen(true);
  }, []);

  const handleUpdateMember = (updatedMember: FamilyMember) => {
    const newTree = updateNode(treeData, updatedMember);
    setTreeData(newTree);
    setSelectedMember(updatedMember);
  };

  const handleAddChild = (parentId: string) => {
    const newTree = addChildNode(treeData, parentId);
    setTreeData(newTree);
  };

  const handleAddSibling = (siblingId: string) => {
    const newTree = addSiblingNode(treeData, siblingId);
    setTreeData(newTree);
  };

  const handleAddParent = () => addParentToRoot(treeData);
  
  const handleDeleteMember = (id: string) => {
    if (id === treeData.id) { alert("برای حذف ریشه اصلی، لطفا صفحه را رفرش کنید."); return; }
    const newTree = deleteNode(treeData, id);
    if (newTree) { setTreeData(newTree); setSelectedMember(null); }
  };

  const handleAddConnection = (sourceId: string, targetId: string, label: string) => {
    const newTree = addConnectionNode(treeData, sourceId, targetId, label);
    setTreeData(newTree);
    const updatedSource = findNode(newTree, sourceId);
    if (updatedSource) setSelectedMember(updatedSource);
  };

  const handleRemoveConnection = (sourceId: string, targetId: string) => {
    const newTree = removeConnectionNode(treeData, sourceId, targetId);
    setTreeData(newTree);
    const updatedSource = findNode(newTree, sourceId);
    if (updatedSource) setSelectedMember(updatedSource);
  };

  const handleExportJSON = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(treeData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "nasab_family_tree.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleImportClick = () => fileInputRef.current?.click();
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileObj = event.target.files && event.target.files[0];
      if (!fileObj) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if(json.id && json.name) { setTreeData(json); setSelectedMember(null); alert("شجره‌نامه بارگذاری شد."); } 
              else alert("فایل نامعتبر است.");
          } catch (err) { alert("خطا در خواندن فایل."); }
      };
      reader.readAsText(fileObj);
      event.target.value = '';
  };

  const handleReset = () => {
      if(window.confirm("آیا مطمئن هستید؟ تمام اطلاعات پاک شده و به حالت اولیه باز می‌گردد.")) {
          setTreeData(defaultFamilyData);
          localStorage.removeItem(STORAGE_KEY);
      }
  }

  const glassClass = theme === 'dark' ? 'glass-panel-dark' : (theme === 'vintage' ? 'glass-panel-vintage' : 'glass-panel');

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
      <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".json" onChange={handleFileChange} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        {!isFullScreen && (
        <header className={`${glassClass} border-b-0 rounded-b-2xl mx-4 mt-2 px-4 py-3 flex justify-between items-center shadow-lg z-20 relative transition-all animate-fade-in-scale`}>
          <div className="flex items-center gap-4 lg:gap-6">
             <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${theme === 'vintage' ? 'bg-[#cb4b16]' : 'bg-gradient-to-br from-teal-500 to-teal-700'}`}>
                    <span className="text-xl">🌳</span> 
                </div>
                <div className="flex flex-col">
                    <h1 className={`text-lg font-bold tracking-tight leading-none ${theme === 'vintage' ? 'font-serif text-[#b58900]' : ''}`}>نسب‌نما</h1>
                    <div className="flex items-center gap-1 text-[10px] tracking-wider opacity-70">
                        {saveStatus === 'saving' && <><RefreshCcw size={10} className="animate-spin"/> در حال ذخیره...</>}
                        {saveStatus === 'saved' && <><CheckCircle2 size={10} className="text-teal-500"/> ذخیره شد</>}
                        {saveStatus === 'unsaved' && <span className="text-red-500">ذخیره نشده</span>}
                    </div>
                </div>
             </div>
             
             {/* Search */}
             <div className="relative hidden lg:block group">
                <div className={`flex items-center rounded-xl px-4 py-2 border w-96 transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50 hover:bg-white/60'}`}>
                   <Search size={18} className="text-slate-400 ml-2"/>
                   <input 
                     type="text" 
                     placeholder="جستجو..." 
                     className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
                     value={searchQuery}
                     onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                     onFocus={() => setIsSearchOpen(true)}
                   />
                </div>
             </div>
          </div>
          
          <div className="flex gap-3 items-center">
             
             {/* Theme Toggles */}
             <div className={`flex p-1 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
                 {['modern', 'vintage', 'dark'].map((t) => (
                     <button key={t} onClick={() => setTheme(t as AppTheme)} className={`p-2 rounded-md transition-all ${theme === t ? 'bg-white/80 shadow text-teal-600' : 'opacity-50 hover:opacity-100'}`}>
                         {t === 'modern' ? <Palette size={16}/> : (t === 'vintage' ? '📜' : '🌙')}
                     </button>
                 ))}
             </div>

             <div className="h-6 w-px bg-current mx-1 hidden sm:block opacity-20"></div>

             {/* File Controls */}
             <div className={`flex p-1 rounded-lg border hidden sm:flex ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
                 <button onClick={handleExportJSON} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100 text-blue-600" title="دانلود فایل"><Download size={18} /></button>
                 <button onClick={handleImportClick} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100 text-teal-600" title="آپلود فایل"><Upload size={18} /></button>
             </div>
             
             <button onClick={handleReset} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded border border-transparent hover:border-red-200 transition-all">
                 شروع تازه
             </button>

          </div>
        </header>
        )}

        {/* Tree Visualization */}
        <div className="flex-1 p-6 overflow-hidden bg-transparent relative">
          <FamilyTree 
            data={treeData} 
            onNodeClick={handleNodeClick} 
            selectedId={selectedMember?.id}
            orientation={orientation}
            theme={theme}
            highlightedIds={highlightedIds}
            onAddChild={handleAddChild}
            onAddSibling={handleAddSibling}
          />
        </div>
      </div>

      {/* Sidebar Panel */}
      {(!isFullScreen || isPanelOpen) && (
      <div className={`fixed inset-y-0 left-0 w-full md:w-[28rem] shadow-2xl transform transition-all duration-500 cubic-bezier(0.25, 0.8, 0.25, 1) z-40 ${isPanelOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-90'} md:relative md:translate-x-0 border-r flex flex-col ${theme === 'dark' ? 'glass-panel-dark border-slate-700' : 'glass-panel border-white/40'}`}>
        <div className="absolute top-4 left-4 md:hidden z-50">
           <button onClick={() => setIsPanelOpen(false)} className="p-2 bg-white/80 backdrop-blur rounded-full shadow-lg"><X size={20} /></button>
        </div>
        <MemberPanel 
          member={selectedMember} 
          allMembers={allMembers}
          onUpdateMember={handleUpdateMember}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onAddParent={handleAddParent}
          onDeleteMember={handleDeleteMember}
          onAddConnection={handleAddConnection}
          onRemoveConnection={handleRemoveConnection}
          calculateRelationship={calculateRelationship}
          onHighlightPath={handleHighlightPath}
          onAddSpouse={handleAddSpouse}
        />
      </div>
      )}
    </div>
  );
};

export default App;
