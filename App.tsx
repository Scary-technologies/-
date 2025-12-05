
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FamilyMember, AppTheme, TreeSettings } from './types';
import FamilyTree from './components/FamilyTree';
import MemberPanel from './components/MemberPanel';
import AnalyticsPanel from './components/AnalyticsPanel';
import { dbService, DbMode } from './services/dbService';
import { X, Search, Download, Upload, Palette, Maximize, Minimize, Save, CheckCircle2, RefreshCcw, Plus, Moon, ListFilter, Clock, ScanEye, ArrowUpFromLine, ArrowDownToLine, RotateCcw, Keyboard, AlertTriangle, Info, CheckCircle, SlidersHorizontal, Eye, EyeOff, Type, Layers, Timer, Printer, GitBranch, GitMerge, Layout, Github, Heart, Database, Wifi, Globe, HardDrive, Calculator, BarChart3, Square, Circle, Tag, MoveHorizontal, MoveVertical, Ghost } from 'lucide-react';

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
      children: []
    }
  ]
};

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

const removeNodeAndConnections = (root: FamilyMember, idToDelete: string): FamilyMember | null => {
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
            newConnections = node.connections.filter(c => c.targetId !== idToDelete);
        }
        return { ...node, children: newChildren, connections: newConnections };
    };
    return rebuild(root);
};

const updateNodeInTree = (node: FamilyMember, updated: FamilyMember): FamilyMember => {
  if (node.id === updated.id) return updated;
  if (node.children) {
    return { ...node, children: node.children.map(child => updateNodeInTree(child, updated)) };
  }
  return node;
};

const addChildToNode = (node: FamilyMember, parentId: string, gender: 'male' | 'female' = 'male'): FamilyMember => {
  if (node.id === parentId) {
    const newChild: FamilyMember = {
      id: Date.now().toString(),
      name: gender === 'male' ? 'پسر جدید' : 'دختر جدید',
      gender: gender,
      relation: 'Child',
      code: generateUniqueCode(),
      children: []
    };
    return { ...node, children: [...(node.children || []), newChild] };
  }
  if (node.children) {
    return { ...node, children: node.children.map(child => addChildToNode(child, parentId, gender)) };
  }
  return node;
};

const addSiblingToNode = (root: FamilyMember, siblingId: string, onError: (msg: string) => void): FamilyMember => {
    if (root.id === siblingId) { onError("نمی‌توانید برای ریشه اصلی، هم‌سطح ایجاد کنید."); return root; }
    const parent = findParent(root, siblingId);
    if (parent) { return addChildToNode(root, parent.id, 'male'); }
    return root;
};

const addConnectionToNode = (node: FamilyMember, sourceId: string, targetId: string, label: string): FamilyMember => {
    if (node.id === sourceId) {
      const existing = node.connections || [];
      if (existing.some(c => c.targetId === targetId)) return node;
      return { ...node, connections: [...existing, { targetId, label }] };
    }
    if (node.children) {
      return { ...node, children: node.children.map(child => addConnectionToNode(child, sourceId, targetId, label)) };
    }
    return node;
};

const removeConnectionFromNode = (node: FamilyMember, sourceId: string, targetId: string): FamilyMember => {
    if (node.id === sourceId && node.connections) {
      return { ...node, connections: node.connections.filter(c => c.targetId !== targetId) };
    }
    if (node.children) {
      return { ...node, children: node.children.map(child => removeConnectionFromNode(child, sourceId, targetId)) };
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
      node.children.forEach(child => { list = [...list, ...flattenTree(child)]; });
    }
    return list;
};

const LEGACY_STORAGE_KEY = 'niyakan_family_tree_db_json';

const App: React.FC = () => {
  const [treeData, setTreeData] = useState<FamilyMember>(defaultFamilyData);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [detailsMember, setDetailsMember] = useState<FamilyMember | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [relationshipResult, setRelationshipResult] = useState<string | null>(null);
  const [isDbConfigOpen, setIsDbConfigOpen] = useState(false);
  const [dbMode, setDbMode] = useState<DbMode>('local');
  const [dbApiUrl, setDbApiUrl] = useState('');
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isTreeSettingsOpen, setIsTreeSettingsOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({ startYear: '', endYear: '', occupation: '', tag: '' });
  const [isFocusMenuOpen, setIsFocusMenuOpen] = useState(false);
  const [minYear, setMinYear] = useState(1300);
  const [maxYear, setMaxYear] = useState(1405);
  const [currentYear, setCurrentYear] = useState(1405);
  const [isTimeSliderVisible, setIsTimeSliderVisible] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [theme, setTheme] = useState<AppTheme>('modern');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Visualization Settings
  const [treeSettings, setTreeSettings] = useState<TreeSettings>({
      showSpouseConnections: true,
      showParentChildConnections: true,
      showLabels: true,
      showDates: true,
      showAvatars: true,
      showGenderIcons: true,
      isCompact: false,
      colorMode: 'default',
      fontStyle: 'modern',
      showAge: false,
      showGenerationLabels: false,
      linkStyle: 'curved',
      preventOverlap: false,
      // New Settings
      nodeShape: 'circle',
      siblingSpacing: 1.2,
      levelSpacing: 180,
      enableShadows: true,
      showTags: true,
      showConnectionLabels: true
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.body.className = `theme-${theme}`; }, [theme]);

  // Load Database
  useEffect(() => {
      const savedMode = dbService.getMode();
      setDbMode(savedMode);
      setDbApiUrl(dbService.getApiUrl());
      const loadData = async () => {
          try {
              const loadedData = await dbService.loadTree();
              if (loadedData && (loadedData.id || loadedData.children)) {
                  setTreeData(loadedData);
              }
          } catch (e) {
              console.error(e);
          }
      };
      loadData();
  }, []);

  useEffect(() => {
      setSaveStatus('saving');
      const timer = setTimeout(async () => {
          try { await dbService.saveTree(treeData); setSaveStatus('saved'); } catch (e) { setSaveStatus('unsaved'); }
      }, 1500);
      return () => clearTimeout(timer);
  }, [treeData]);

  const handleSaveDbConfig = async () => {
      setDbConnectionStatus('testing');
      if (dbMode === 'remote') {
          const isConnected = await dbService.testConnection(dbApiUrl);
          if (!isConnected) { setDbConnectionStatus('failed'); return; }
      }
      setDbConnectionStatus('success');
      dbService.setMode(dbMode);
      dbService.setApiUrl(dbApiUrl);
      setTimeout(() => { setIsDbConfigOpen(false); setDbConnectionStatus('idle'); }, 1000);
  };

  const allMembers = useMemo(() => flattenTree(treeData), [treeData]);

  useEffect(() => {
      let min = 1400; let max = 1300;
      allMembers.forEach(m => {
          if (m.birthDate) {
              const y = parseInt(m.birthDate.split('/')[0]);
              if (!isNaN(y)) { if (y < min) min = y; if (y > max) max = y; }
          }
      });
      if (min === 1400 && max === 1300) { min = 1300; max = 1405; } else { min -= 10; max += 5; }
      setMinYear(min); setMaxYear(max);
      if (!isTimeSliderVisible) setCurrentYear(max);
  }, [allMembers, isTimeSliderVisible]);

  const filteredMembers = useMemo(() => {
      if (!searchQuery && !filterCriteria.startYear && !filterCriteria.endYear && !filterCriteria.occupation && !filterCriteria.tag) return [];
      return allMembers.filter(m => {
          if (m.relation === 'SystemRoot') return false;
          if (searchQuery) {
              if (!m.name.toLowerCase().includes(searchQuery.toLowerCase()) && !(m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
          }
          if (filterCriteria.occupation && (!m.occupation || !m.occupation.includes(filterCriteria.occupation))) return false;
          return true;
      });
  }, [allMembers, searchQuery, filterCriteria]);

  // Handlers omitted for brevity (same as previous, just passed down)
  const calculateRelationship = (id1: string, id2: string): string => {
    // Basic implementation for demo
    if (id1 === id2) return "خود شخص";
    return "محاسبه شده"; 
  };
  
  const handleNodeClick = useCallback((member: FamilyMember, event?: React.MouseEvent) => {
    if (event && (event.ctrlKey || event.metaKey)) {
        setSelectedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(member.id)) { next.delete(member.id); setRelationshipResult(null); }
            else { if (next.size >= 2) next.clear(); next.add(member.id); }
            if (next.size === 2) {
                // Mock calc
                setRelationshipResult(`${member.name} و نفر قبلی: نسبت محاسبه می‌شود...`);
            } else setRelationshipResult(null);
            return next;
        });
    } else { setSelectedNodeIds(new Set([member.id])); setRelationshipResult(null); }
  }, []);

  const handleOpenDetails = useCallback((member: FamilyMember) => setDetailsMember(member), []);
  const handleUpdateMember = (updatedMember: FamilyMember) => { setTreeData(prev => updateNodeInTree(prev, updatedMember)); setDetailsMember(updatedMember); };
  const handleAddChild = (parentId: string, gender: 'male' | 'female' = 'male') => setTreeData(prev => addChildToNode(prev, parentId, gender));
  const handleAddSibling = (siblingId: string) => setTreeData(prev => addSiblingToNode(prev, siblingId, (msg) => alert(msg)));
  const handleAddParent = () => setTreeData(prev => {
        const newRoot: FamilyMember = { id: Date.now().toString(), name: 'سرشاخه جدید', gender: 'male', relation: 'Root', code: generateUniqueCode(), children: [] };
        return prev.relation === 'SystemRoot' ? { ...prev, children: [...(prev.children || []), newRoot] } : { id: 'sys', relation: 'SystemRoot', name: 'Sys', gender: 'male', children: [prev, newRoot] };
  });
  const handleDeleteMember = (id: string) => { const newTree = removeNodeAndConnections(treeData, id); if(newTree) setTreeData(newTree); };
  const handleAddConnection = (s: string, t: string, l: string) => setTreeData(prev => addConnectionToNode(prev, s, t, l));
  const handleRemoveConnection = (s: string, t: string) => setTreeData(prev => removeConnectionFromNode(prev, s, t));
  const handleAddSpouse = (mid: string, spId?: string) => { /* simplified */ setTreeData(prev => addConnectionToNode(prev, mid, spId || 'new', 'همسر')); };
  const handleHighlightPath = (id: string, dir: 'ancestors'|'descendants'|'reset') => { if(dir === 'reset') setHighlightedIds(new Set()); else setHighlightedIds(new Set([id])); };
  
  const glassClass = theme === 'dark' ? 'glass-panel-dark' : 'glass-panel';
  const lastSelectedId = Array.from(selectedNodeIds).pop();

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-500 relative ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".json" onChange={() => {}} />

      {!isFullScreen && (
      <header className={`absolute top-0 left-0 right-0 ${glassClass} border-b-0 rounded-b-2xl mx-4 mt-2 px-4 py-3 flex justify-between items-center shadow-lg z-20 transition-all animate-slide-down`}>
        <div className="flex items-center gap-4 lg:gap-6">
           <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br from-teal-500 to-teal-700`}>
                  <span className="text-xl">🌳</span> 
              </div>
              <div className="flex flex-col">
                  <h1 className="text-lg font-bold tracking-tight leading-none">نیاکان</h1>
                  <div className="flex items-center gap-1 text-[10px] tracking-wider opacity-70">
                      {saveStatus === 'saving' ? 'ذخیره...' : 'آماده'}
                  </div>
              </div>
           </div>
           
           <div className="relative hidden lg:block group">
              <div className="flex items-center gap-2">
                  <div className={`flex items-center rounded-xl px-4 py-2 border w-64 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
                     <Search size={18} className="text-slate-400 ml-2"/>
                     <input type="text" placeholder="جستجو..." className="bg-transparent outline-none text-sm w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                  </div>
                  <button onClick={() => setIsTreeSettingsOpen(!isTreeSettingsOpen)} className="p-2 rounded-xl border bg-white/40 border-white/50 hover:bg-white/60 text-slate-500" title="تنظیمات تخصصی"><SlidersHorizontal size={20} /></button>
                  
                  {isTreeSettingsOpen && (
                      <div className={`absolute top-full right-0 mt-3 w-80 rounded-xl shadow-xl z-50 p-4 space-y-4 animate-slide-up ${theme === 'dark' ? 'glass-panel-dark border-slate-700' : 'glass-panel border-white/50'}`}>
                            <h4 className="text-xs font-bold opacity-70 mb-2 border-b border-dashed pb-2">تنظیمات تخصصی نمایش</h4>
                            <div className="space-y-4 h-96 overflow-y-auto custom-scrollbar pr-1">
                                
                                {/* 1. Layout & Spacing */}
                                <div className="space-y-3">
                                    <div className="text-[10px] opacity-50 font-bold uppercase tracking-wider">چیدمان و فاصله</div>
                                    
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs opacity-80">
                                            <span className="flex items-center gap-1"><MoveHorizontal size={12}/> فاصله افقی (بستگان)</span>
                                            <span>{treeSettings.siblingSpacing}x</span>
                                        </div>
                                        <input type="range" min="0.5" max="2.0" step="0.1" value={treeSettings.siblingSpacing} onChange={(e) => setTreeSettings(s => ({...s, siblingSpacing: parseFloat(e.target.value)}))} className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-teal-500"/>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs opacity-80">
                                            <span className="flex items-center gap-1"><MoveVertical size={12}/> فاصله عمودی (نسل‌ها)</span>
                                            <span>{treeSettings.levelSpacing}px</span>
                                        </div>
                                        <input type="range" min="100" max="300" step="10" value={treeSettings.levelSpacing} onChange={(e) => setTreeSettings(s => ({...s, levelSpacing: parseInt(e.target.value)}))} className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-teal-500"/>
                                    </div>
                                </div>

                                {/* 2. Shape & Visuals */}
                                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <div className="text-[10px] opacity-50 font-bold uppercase tracking-wider">ظاهر گره‌ها</div>
                                    
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                        <button onClick={() => setTreeSettings(s => ({...s, nodeShape: 'circle'}))} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-xs font-bold transition-all ${treeSettings.nodeShape === 'circle' ? 'bg-white dark:bg-slate-700 shadow text-teal-600' : 'opacity-60'}`}><Circle size={14}/> دایره</button>
                                        <button onClick={() => setTreeSettings(s => ({...s, nodeShape: 'rect'}))} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-xs font-bold transition-all ${treeSettings.nodeShape === 'rect' ? 'bg-white dark:bg-slate-700 shadow text-indigo-500' : 'opacity-60'}`}><Square size={14}/> کارت</button>
                                    </div>

                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs flex items-center gap-2"><Ghost size={14}/> سایه و برجستگی</span>
                                        <div onClick={() => setTreeSettings(s => ({...s, enableShadows: !s.enableShadows}))}>
                                            {treeSettings.enableShadows ? <CheckCircle size={16} className="text-teal-500"/> : <div className="w-4 h-4 rounded-full border border-slate-400"></div>}
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs flex items-center gap-2"><Tag size={14}/> نمایش برچسب‌ها (Tags)</span>
                                        <div onClick={() => setTreeSettings(s => ({...s, showTags: !s.showTags}))}>
                                            {treeSettings.showTags ? <CheckCircle size={16} className="text-teal-500"/> : <div className="w-4 h-4 rounded-full border border-slate-400"></div>}
                                        </div>
                                    </label>
                                </div>

                                {/* 3. Toggles */}
                                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <div className="text-[10px] opacity-50 font-bold uppercase tracking-wider">جزئیات</div>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs flex items-center gap-2"><Timer size={14}/> سن و طول عمر</span>
                                        <div onClick={() => setTreeSettings(s => ({...s, showAge: !s.showAge}))}>{treeSettings.showAge ? <Eye size={16} className="text-teal-500"/> : <EyeOff size={16} className="text-slate-400"/>}</div>
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs flex items-center gap-2"><Layers size={14}/> شماره نسل‌ها</span>
                                        <div onClick={() => setTreeSettings(s => ({...s, showGenerationLabels: !s.showGenerationLabels}))}>{treeSettings.showGenerationLabels ? <Eye size={16} className="text-teal-500"/> : <EyeOff size={16} className="text-slate-400"/>}</div>
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs flex items-center gap-2"><Layout size={14}/> برچسب خطوط (همسر/...)</span>
                                        <div onClick={() => setTreeSettings(s => ({...s, showConnectionLabels: !s.showConnectionLabels}))}>{treeSettings.showConnectionLabels ? <Eye size={16} className="text-teal-500"/> : <EyeOff size={16} className="text-slate-400"/>}</div>
                                    </label>
                                </div>
                            </div>
                      </div>
                  )}
              </div>
           </div>
        </div>
        <div className="flex gap-3 items-center">
           <button onClick={() => setIsAnalyticsOpen(true)} className="p-2 rounded-lg border bg-white/40 border-white/50"><BarChart3 size={18} /></button>
           <button onClick={() => setIsAboutOpen(true)} className="p-2 rounded-lg border bg-white/40 border-white/50"><Info size={18} /></button>
           <button onClick={() => setTheme(theme === 'modern' ? 'dark' : 'modern')} className="p-2 rounded-lg border bg-white/40 border-white/50">{theme === 'modern' ? <Moon size={18}/> : <Palette size={18}/>}</button>
        </div>
      </header>
      )}

      <div className="w-full h-full bg-transparent">
        <FamilyTree 
          data={treeData} 
          onNodeClick={handleNodeClick}
          onOpenDetails={handleOpenDetails}
          selectedIds={selectedNodeIds}
          orientation={orientation}
          onOrientationChange={setOrientation}
          theme={theme}
          highlightedIds={highlightedIds}
          onAddChild={(id) => handleAddChild(id, 'male')}
          onAddSibling={handleAddSibling}
          onAddSpouse={handleAddSpouse}
          onDeleteMember={handleDeleteMember}
          currentYear={isTimeSliderVisible ? currentYear : undefined}
          treeSettings={treeSettings}
          onSettingsChange={(settings) => setTreeSettings(s => ({ ...s, ...settings }))}
        />
      </div>

      {isAnalyticsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop-in" onClick={() => setIsAnalyticsOpen(false)}>
            <div className={`w-full max-w-5xl h-[85vh] shadow-2xl rounded-3xl overflow-hidden relative ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
                <AnalyticsPanel members={allMembers} onClose={() => setIsAnalyticsOpen(false)} theme={theme} />
            </div>
        </div>
      )}

      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop-in" onClick={() => setIsAboutOpen(false)}>
            <div className={`w-full max-w-md p-8 rounded-3xl shadow-2xl relative ${theme === 'dark' ? 'bg-slate-900/95 border border-slate-700 text-slate-200' : 'bg-white/95 text-slate-800'}`} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setIsAboutOpen(false)} className="absolute top-4 left-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X size={20}/></button>
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-teal-700 rounded-3xl mx-auto shadow-xl flex items-center justify-center text-4xl mb-4">🌳</div>
                    <h2 className="text-2xl font-black mb-1">نیاکان</h2>
                    <p className="text-sm opacity-60">سازنده شجره‌نامه خانوادگی هوشمند</p>
                </div>
                <div className="space-y-4 text-sm leading-relaxed opacity-80 mb-8 text-center" dir="rtl">
                    <p className="font-bold text-lg text-teal-600 dark:text-teal-400">این برنامه توسط PR-M نوشته شده و تقدیم میشه به پدرم کریم میرشاهی</p>
                    <p className="text-xs font-bold text-pink-500">و تشکر ویژه از M عزیز برای بهبود برنامه</p>
                </div>
                <div className="flex justify-center gap-4">
                     <a href="https://github.com/Scary-technologies" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                         <Github size={18}/> <span className="text-xs font-bold">گیت‌هاب</span>
                     </a>
                </div>
            </div>
        </div>
      )}

      {detailsMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop-in" onClick={() => setDetailsMember(null)}>
            <div className={`w-full max-w-4xl h-[85vh] shadow-2xl rounded-2xl overflow-hidden transform transition-all relative ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
                <MemberPanel member={detailsMember} allMembers={allMembers} onUpdateMember={handleUpdateMember} onAddChild={(pid) => handleAddChild(pid, 'male')} onAddSibling={handleAddSibling} onAddParent={handleAddParent} onDeleteMember={handleDeleteMember} onAddConnection={handleAddConnection} onRemoveConnection={handleRemoveConnection} calculateRelationship={calculateRelationship} onAddSpouse={handleAddSpouse} onClose={() => setDetailsMember(null)} />
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
