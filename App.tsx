
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FamilyMember, AppTheme } from './types';
import FamilyTree from './components/FamilyTree';
import MemberPanel from './components/MemberPanel';
import { Menu, X, Search, Download, Upload, Palette, Maximize, Minimize, Save, Cloud, CheckCircle2, RefreshCcw, Plus, Moon } from 'lucide-react';

// Historical Context Data
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

// Helper to generate unique 6-char code
const generateUniqueCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

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

// --- PURE TREE LOGIC FUNCTIONS (Outside Component) ---

const findNode = (node: FamilyMember, id: string): FamilyMember | null => {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
};

const findParent = (root: FamilyMember, targetId: string): FamilyMember | null => {
  if (root.children) {
    for (const child of root.children) {
      if (child.id === targetId) return root;
      const found = findParent(child, targetId);
      if (found) return found;
    }
  }
  return null;
};

// Removes a node AND cleans up any connections pointing to it in the entire tree
const removeNodeAndConnections = (root: FamilyMember, idToDelete: string): FamilyMember | null => {
    // Recursive function to rebuild tree excluding the deleted node
    // and filtering connections in preserved nodes
    const rebuild = (node: FamilyMember): FamilyMember | null => {
        if (node.id === idToDelete) return null;

        let newChildren: FamilyMember[] | undefined = undefined;
        if (node.children) {
            newChildren = node.children
                .map(child => rebuild(child))
                .filter((child): child is FamilyMember => child !== null);
        }

        let newConnections = node.connections;
        if (node.connections) {
            // Remove any connection that points to the deleted ID
            newConnections = node.connections.filter(c => c.targetId !== idToDelete);
        }

        return {
            ...node,
            children: newChildren,
            connections: newConnections
        };
    };

    return rebuild(root);
};

const updateNodeInTree = (node: FamilyMember, updated: FamilyMember): FamilyMember => {
  if (node.id === updated.id) return updated;
  if (node.children) {
    return {
      ...node,
      children: node.children.map(child => updateNodeInTree(child, updated))
    };
  }
  return node;
};

const addChildToNode = (node: FamilyMember, parentId: string): FamilyMember => {
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
      children: node.children.map(child => addChildToNode(child, parentId))
    };
  }
  return node;
};

const addSiblingToNode = (root: FamilyMember, siblingId: string): FamilyMember => {
    if (root.id === siblingId) {
      alert("نمی‌توانید برای ریشه اصلی، هم‌سطح ایجاد کنید.");
      return root;
    }
    const parent = findParent(root, siblingId);
    if (parent) {
       return addChildToNode(root, parent.id);
    }
    return root;
};

const addConnectionToNode = (node: FamilyMember, sourceId: string, targetId: string, label: string): FamilyMember => {
    if (node.id === sourceId) {
      const existing = node.connections || [];
      if (existing.some(c => c.targetId === targetId)) return node;
      return { ...node, connections: [...existing, { targetId, label }] };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => addConnectionToNode(child, sourceId, targetId, label))
      };
    }
    return node;
};

const removeConnectionFromNode = (node: FamilyMember, sourceId: string, targetId: string): FamilyMember => {
    if (node.id === sourceId && node.connections) {
      return {
        ...node,
        connections: node.connections.filter(c => c.targetId !== targetId)
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => removeConnectionFromNode(child, sourceId, targetId))
      };
    }
    return node;
};

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

const flattenTree = (node: FamilyMember): FamilyMember[] => {
    let list = [node];
    if (node.children) {
      node.children.forEach(child => {
        list = [...list, ...flattenTree(child)];
      });
    }
    return list;
};

// --- MAIN COMPONENT ---

const STORAGE_KEY = 'nasab_family_tree_autosave';

const App: React.FC = () => {
  const [treeData, setTreeData] = useState<FamilyMember>(defaultFamilyData);
  
  // Selection & Modal State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailsMember, setDetailsMember] = useState<FamilyMember | null>(null);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [theme, setTheme] = useState<AppTheme>('modern');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme
  useEffect(() => {
      document.body.className = `theme-${theme}`;
  }, [theme]);

  // Auto Load
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

  // Auto Save
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
      }, 1000);

      return () => clearTimeout(timer);
  }, [treeData]);

  const allMembers = useMemo(() => flattenTree(treeData), [treeData]);

  // --- HANDLERS ---

  const handleNodeClick = useCallback((member: FamilyMember) => {
    setSelectedNodeId(member.id);
  }, []);

  const handleOpenDetails = useCallback((member: FamilyMember) => {
    setDetailsMember(member);
  }, []);

  const handleUpdateMember = (updatedMember: FamilyMember) => {
    setTreeData(prev => updateNodeInTree(prev, updatedMember));
    setDetailsMember(updatedMember);
  };

  const handleAddChild = (parentId: string) => {
    setTreeData(prev => addChildToNode(prev, parentId));
  };

  const handleAddSibling = (siblingId: string) => {
    setTreeData(prev => addSiblingToNode(prev, siblingId));
  };

  const handleAddParent = () => {
    setTreeData(prev => {
        const newClanRoot: FamilyMember = {
            id: Date.now().toString(),
            name: 'سرشاخه جدید',
            gender: 'male',
            relation: 'Root',
            code: generateUniqueCode(),
            children: []
        };

        if (prev.relation === 'SystemRoot') {
            return {
                ...prev,
                children: [...(prev.children || []), newClanRoot]
            };
        } else {
            return {
                id: 'system_root',
                name: 'System Root',
                relation: 'SystemRoot',
                gender: 'male',
                children: [prev, newClanRoot]
            };
        }
    });
  };
  
  const handleDeleteMember = (id: string) => {
    if (id === treeData.id) { 
        alert("برای حذف ریشه اصلی سیستم، لطفا از دکمه شروع تازه استفاده کنید."); 
        return; 
    }
    
    const newTree = removeNodeAndConnections(treeData, id);
    
    if (newTree) { 
        setTreeData(newTree); 
        // Close modal and clear selection if the deleted member was active
        if (detailsMember?.id === id) setDetailsMember(null);
        if (selectedNodeId === id) setSelectedNodeId(null);
    } else {
        // If newTree is null, it means the system root was somehow deleted (unlikely due to id check)
        alert("خطا در حذف عضو.");
    }
  };

  const handleAddConnection = (sourceId: string, targetId: string, label: string) => {
    setTreeData(prev => addConnectionToNode(prev, sourceId, targetId, label));
    // Update modal if needed
    const updatedSource = findNode(addConnectionToNode(treeData, sourceId, targetId, label), sourceId);
    if (updatedSource && detailsMember?.id === sourceId) setDetailsMember(updatedSource);
  };

  const handleRemoveConnection = (sourceId: string, targetId: string) => {
    setTreeData(prev => removeConnectionFromNode(prev, sourceId, targetId));
    // Update modal if needed
    const updatedSource = findNode(removeConnectionFromNode(treeData, sourceId, targetId), sourceId);
    if (updatedSource && detailsMember?.id === sourceId) setDetailsMember(updatedSource);
  };

  const handleAddSpouse = (memberId: string, existingSpouseId?: string) => {
      setTreeData(prev => {
          let newTree = prev;
          if (existingSpouseId) {
              newTree = addConnectionToNode(newTree, memberId, existingSpouseId, 'همسر');
              newTree = addConnectionToNode(newTree, existingSpouseId, memberId, 'همسر');
              alert("ازدواج فامیلی ثبت شد.");
          } else {
              const member = findNode(newTree, memberId);
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

              // Attach new spouse to system root to make it a "Forest" node
              if (newTree.relation === 'SystemRoot') {
                   newTree = {
                       ...newTree,
                       children: [...(newTree.children || []), newSpouse]
                   };
              } else {
                  // Wrap single root into system root if not already
                  newTree = {
                      id: 'system_root_auto',
                      relation: 'SystemRoot',
                      name: 'System',
                      gender: 'male',
                      children: [newTree, newSpouse]
                  };
              }
              newTree = addConnectionToNode(newTree, memberId, newSpouse.id, 'همسر');
              newTree = addConnectionToNode(newTree, newSpouse.id, memberId, 'همسر');
          }
          return newTree;
      });
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
              if(json.id && json.name) { 
                  setTreeData(json); 
                  setDetailsMember(null); 
                  setSelectedNodeId(null); 
                  alert("شجره‌نامه بارگذاری شد."); 
              } 
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
          setDetailsMember(null);
          setSelectedNodeId(null);
      }
  }

  const glassClass = theme === 'dark' ? 'glass-panel-dark' : 'glass-panel';

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-500 relative ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
      <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".json" onChange={handleFileChange} />

      {/* Header */}
      {!isFullScreen && (
      <header className={`absolute top-0 left-0 right-0 ${glassClass} border-b-0 rounded-b-2xl mx-4 mt-2 px-4 py-3 flex justify-between items-center shadow-lg z-20 transition-all animate-fade-in-scale`}>
        <div className="flex items-center gap-4 lg:gap-6">
           <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br from-teal-500 to-teal-700`}>
                  <span className="text-xl">🌳</span> 
              </div>
              <div className="flex flex-col">
                  <h1 className="text-lg font-bold tracking-tight leading-none">نسب‌نما</h1>
                  <div className="flex items-center gap-1 text-[10px] tracking-wider opacity-70">
                      {saveStatus === 'saving' && <><RefreshCcw size={10} className="animate-spin"/> در حال ذخیره...</>}
                      {saveStatus === 'saved' && <><CheckCircle2 size={10} className="text-teal-500"/> ذخیره شد</>}
                      {saveStatus === 'unsaved' && <span className="text-red-500">ذخیره نشده</span>}
                  </div>
              </div>
           </div>
           
           <button onClick={handleAddParent} className="hidden md:flex items-center gap-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
               <Plus size={14} /> ایجاد خاندان جدید
           </button>
           
           {/* Search */}
           <div className="relative hidden lg:block group">
              <div className={`flex items-center rounded-xl px-4 py-2 border w-64 focus-within:w-80 transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50 hover:bg-white/60'}`}>
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
              {isSearchOpen && searchQuery && (
                  <div className={`absolute top-full left-0 w-full mt-2 rounded-xl shadow-xl overflow-hidden z-50 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-100'}`}>
                      {allMembers.filter(m => m.name.includes(searchQuery) && m.relation !== 'SystemRoot').slice(0, 5).map(result => (
                          <button 
                            key={result.id} 
                            className={`w-full text-right px-4 py-2 text-sm flex justify-between items-center hover:bg-teal-50/50 ${theme === 'dark' ? 'hover:bg-white/5 text-slate-300' : 'text-slate-700'}`}
                            onClick={() => {
                                setSelectedNodeId(result.id);
                                setIsSearchOpen(false);
                                setSearchQuery('');
                            }}
                          >
                              <span>{result.name}</span>
                              <span className="text-xs opacity-50">{result.relation}</span>
                          </button>
                      ))}
                  </div>
              )}
           </div>
        </div>
        
        <div className="flex gap-3 items-center">
           
           {/* Theme Toggles */}
           <div className={`flex p-1 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
               {['modern', 'dark'].map((t) => (
                   <button key={t} onClick={() => setTheme(t as AppTheme)} className={`p-2 rounded-md transition-all ${theme === t ? 'bg-white/80 shadow text-teal-600' : 'opacity-50 hover:opacity-100'}`}>
                       {t === 'modern' ? <Palette size={16}/> : <Moon size={16}/>}
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

      {/* Main Content (Full Screen Tree) */}
      <div className="w-full h-full bg-transparent">
        <FamilyTree 
          data={treeData} 
          onNodeClick={handleNodeClick}
          onOpenDetails={handleOpenDetails}
          selectedId={selectedNodeId}
          orientation={orientation}
          theme={theme}
          highlightedIds={highlightedIds}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
        />
      </div>

      {/* Modal / Popup for Member Details */}
      {detailsMember && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-enter" onClick={() => setDetailsMember(null)}>
            <div 
              className={`w-full max-w-4xl h-[85vh] shadow-2xl rounded-2xl overflow-hidden transform transition-all relative ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}
              onClick={(e) => e.stopPropagation()}
            >
                <MemberPanel 
                  member={detailsMember} 
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
                  onClose={() => setDetailsMember(null)}
                />
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
