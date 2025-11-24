
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FamilyMember, AppTheme } from '../types';
import { Maximize, ZoomIn, ZoomOut, ArrowDown, ArrowRight, Heart, User, Plus, Trash2, GitBranch, GitMerge, XCircle } from 'lucide-react';

// SVG Paths for Gender Icons (Material Design Style)
const MALE_ICON = "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z";
const FEMALE_ICON = "M12,4A4,4 0 0,1 16,8C16,9.95 14.6,11.58 12.75,11.93L12.75,12.09C12.75,12.09 16,13.67 16,18V20H8V18C8,13.9 11.25,12.09 11.25,12.09L11.25,11.93C9.4,11.58 8,9.95 8,8A4,4 0 0,1 12,4Z";

interface FamilyTreeProps {
  data: FamilyMember;
  onNodeClick: (member: FamilyMember) => void;
  onOpenDetails: (member: FamilyMember) => void;
  selectedId?: string | null;
  orientation: 'horizontal' | 'vertical';
  onOrientationChange: (orientation: 'horizontal' | 'vertical') => void;
  theme: AppTheme;
  highlightedIds: Set<string>;
  onAddChild?: (parentId: string) => void;
  onAddSibling?: (memberId: string) => void;
  onAddSpouse?: (memberId: string) => void;
  onDeleteMember?: (id: string) => void;
  currentYear?: number;
}

const FamilyTree: React.FC<FamilyTreeProps> = ({ 
  data, 
  onNodeClick, 
  onOpenDetails,
  selectedId, 
  orientation,
  onOrientationChange,
  theme,
  highlightedIds,
  onAddChild,
  onAddSibling,
  onAddSpouse,
  onDeleteMember,
  currentYear
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomTransform, setZoomTransform] = useState(d3.zoomIdentity.translate(120, 80));
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [linkStyle, setLinkStyle] = useState<'curved' | 'straight'>('curved');
  const [preventOverlap, setPreventOverlap] = useState(false);
  const [selectedNodePos, setSelectedNodePos] = useState<{x: number, y: number} | null>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, member: FamilyMember} | null>(null);
  
  const nodeMapRef = useRef<Map<string, d3.HierarchyPointNode<FamilyMember>>>(new Map());

  // Helper to extract year from date string
  const getBirthYear = (dateStr?: string): number => {
      if (!dateStr) return -1;
      const part = dateStr.split('/')[0];
      const year = parseInt(part);
      return isNaN(year) ? -1 : year;
  };

  // Helper to check visibility based on time-lapse
  const isVisibleInTime = (d: FamilyMember) => {
      if (!currentYear) return true;
      const year = getBirthYear(d.birthDate);
      if (year === -1) return true; 
      return year <= currentYear;
  };

  const getThemeColors = (theme: AppTheme) => {
    switch (theme) {
      case 'dark':
        return {
          link: '#475569',
          linkExtra: '#f59e0b',
          linkSpouse: '#ec4899',
          nodeFill: '#1e293b', 
          maleIcon: '#60a5fa',
          femaleIcon: '#f472b6',
          text: '#f1f5f9',
          textSecondary: '#94a3b8',
          nodeStroke: '#334155',
          selectedRing: '#2dd4bf'
        };
      case 'modern':
      default:
        return {
          link: '#94a3b8',
          linkExtra: '#f59e0b',
          linkSpouse: '#db2777',
          nodeFill: '#f8fafc', 
          maleIcon: '#3b82f6',
          femaleIcon: '#db2777',
          text: '#1e293b',
          textSecondary: '#64748b',
          nodeStroke: '#e2e8f0',
          selectedRing: '#0f766e'
        };
    }
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Sync floating menu position (for selection)
  useEffect(() => {
      if (selectedId && nodeMapRef.current.has(selectedId) && !contextMenu) {
        const sNode = nodeMapRef.current.get(selectedId);
        if (sNode) {
            const t = zoomTransform;
            const x = orientation === 'horizontal' ? sNode.y : sNode.x;
            const y = orientation === 'horizontal' ? sNode.x : sNode.y;
            // Apply zoom transform
            const finalX = t.x + x * t.k; 
            const finalY = t.y + y * t.k;
            setSelectedNodePos({ x: finalX, y: finalY });
        }
      } else {
        setSelectedNodePos(null);
      }
  }, [selectedId, zoomTransform, orientation, dimensions, contextMenu]);

  // Main Graph Drawing
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const colors = getThemeColors(theme);
    const hasHighlight = highlightedIds.size > 0;

    d3.select(svgRef.current).selectAll("*").remove();

    const margin = { top: 80, right: 120, bottom: 80, left: 120 };
    
    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .on("click", () => {
          setContextMenu(null); // Close context menu on bg click
      });

    const g = svg.append("g")
      .attr("transform", zoomTransform.toString());

    // Define Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
          if (event.transform.k === zoomTransform.k && 
              event.transform.x === zoomTransform.x && 
              event.transform.y === zoomTransform.y) return;
          g.attr("transform", event.transform);
          setZoomTransform(event.transform);
          setContextMenu(null); // Close context menu on zoom
        });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Tree Layout
    let treemap;
    if (orientation === 'horizontal') {
        treemap = d3.tree<FamilyMember>()
            .nodeSize([90, 240]) 
            .separation((a, b) => a.parent === b.parent ? 1.2 : 2.5);
    } else {
        treemap = d3.tree<FamilyMember>()
            .nodeSize([160, 160])
            .separation((a, b) => a.parent === b.parent ? 1.2 : 2.5);
    }

    const root = d3.hierarchy(data, (d) => d.children);
    // @ts-ignore
    const nodes = treemap(root);

    nodeMapRef.current.clear();
    nodes.descendants().forEach(d => {
      nodeMapRef.current.set(d.data.id, d);
    });
    
    // Spouse Post-Processing: Move spouses side-by-side
    nodes.descendants().forEach(d => {
        if (d.data.connections) {
            const spouseConn = d.data.connections.find(c => c.label === 'همسر');
            if (spouseConn) {
                const spouseNode = nodeMapRef.current.get(spouseConn.targetId);
                // Only move if both are direct children of system root (forest mode) or specifically structured
                if (spouseNode && d.parent?.data.relation === 'SystemRoot' && spouseNode.parent?.data.relation === 'SystemRoot') {
                     // Move spouse next to this node
                     if (orientation === 'horizontal') {
                         spouseNode.x = d.x;
                         spouseNode.y = d.y + 80; // offset
                     } else {
                         spouseNode.y = d.y;
                         spouseNode.x = d.x + 80;
                     }
                }
            }
        }
    });

    // Extra Links (Connections)
    const extraLinks: any[] = [];
    nodes.descendants().forEach(sourceNode => {
      if (sourceNode.data.connections) {
        sourceNode.data.connections.forEach(conn => {
          const targetNode = nodeMapRef.current.get(conn.targetId);
          if (targetNode) {
            extraLinks.push({
              source: sourceNode,
              target: targetNode,
              label: conn.label
            });
          }
        });
      }
    });

    const customLinkGenerator = (d: any) => {
        let s = d.source;
        let t = d.target;
        
        // Handle Shared Children (Start from midpoint of parents)
        if (s.data.connections && s.data.connections.some((c: any) => c.label === 'همسر')) {
            const spouseConn = s.data.connections.find((c: any) => c.label === 'همسر');
            const spouseNode = nodeMapRef.current.get(spouseConn.targetId);
            if (spouseNode) {
                 // Calculate midpoint
                 const midX = (s.x + spouseNode.x) / 2;
                 const midY = (s.y + spouseNode.y) / 2;
                 // Temporarily override source for drawing
                 s = { x: midX, y: midY };
            }
        }

        if (linkStyle === 'straight') {
             if (orientation === 'horizontal') {
                return `M${s.y},${s.x} L${s.y},${t.x} L${t.y},${t.x}`; 
             } else {
                return `M${s.x},${s.y} L${t.x},${s.y} L${t.x},${t.y}`;
             }
        }

        let offset = 0;
        if (preventOverlap) {
            const idVal = t.data.id ? t.data.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
            offset = ((idVal % 3) - 1) * 20; 
        }

        if (orientation === 'horizontal') {
            const mx = (s.y + t.y) / 2;
            return `M ${s.y} ${s.x} 
                    C ${mx} ${s.x + offset}, 
                      ${mx} ${t.x + offset}, 
                      ${t.y} ${t.x}`;
        } else {
            const my = (s.y + t.y) / 2;
            return `M ${s.x} ${s.y} 
                    C ${s.x + offset} ${my}, 
                      ${t.x + offset} ${my}, 
                      ${t.x} ${t.y}`;
        }
    };

    const gContent = g.append("g");

    // Draw Extra Links
    gContent.selectAll(".extra-link")
      .data(extraLinks)
      .enter().append("path")
      .attr("class", "extra-link")
      .attr("d", (d: any) => {
          // Standard link generator for spouses/connections
          const s = d.source;
          const t = d.target;
          if (orientation === 'horizontal') {
              const mx = (s.y + t.y) / 2;
              return `M ${s.y} ${s.x} C ${mx} ${s.x}, ${mx} ${t.x}, ${t.y} ${t.x}`;
          } else {
              const my = (s.y + t.y) / 2;
              return `M ${s.x} ${s.y} C ${s.x} ${my}, ${t.x} ${my}, ${t.x} ${t.y}`;
          }
      })
      .attr("fill", "none")
      .attr("stroke", (d: any) => d.label === 'همسر' ? colors.linkSpouse : colors.linkExtra)
      .attr("stroke-width", "2px")
      .attr("stroke-dasharray", (d: any) => d.label === 'همسر' ? "0" : "5,5")
      .attr("opacity", (d: any) => {
         if (!isVisibleInTime(d.source.data) || !isVisibleInTime(d.target.data)) return 0;
         if (!hasHighlight) return 0.6;
         const srcHi = highlightedIds.has(d.source.data.id);
         const tgtHi = highlightedIds.has(d.target.data.id);
         return (srcHi && tgtHi) ? 1 : 0.1;
      });

    // Draw Tree Links
    const visibleLinks = nodes.links().filter(d => d.source.data.relation !== 'SystemRoot');
    gContent.selectAll(".link")
      .data(visibleLinks)
      .enter().append("path")
      .attr("class", "link")
      .attr("d", customLinkGenerator)
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
          if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return colors.selectedRing;
          return colors.link;
      })
      .attr("stroke-width", (d: any) => {
         if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return "3px";
         return "1.5px";
      })
      .style("opacity", (d: any) => {
         if (!isVisibleInTime(d.source.data) || !isVisibleInTime(d.target.data)) return 0;
         if (!hasHighlight) return 1;
         if (highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return 1;
         return 0.1;
      });

    // Draw Nodes
    const node = gContent.selectAll(".node")
      .data(nodes.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => orientation === 'horizontal' ? `translate(${d.y},${d.x})` : `translate(${d.x},${d.y})`)
      .style("cursor", "pointer")
      .on("click", (event, d: d3.HierarchyPointNode<FamilyMember>) => {
        if(d.data.relation === 'SystemRoot') return;
        event.stopPropagation();
        onNodeClick(d.data);
      })
      .on("dblclick", (event, d: d3.HierarchyPointNode<FamilyMember>) => {
          if(d.data.relation === 'SystemRoot') return;
          event.stopPropagation();
          onOpenDetails(d.data);
      })
      .on("contextmenu", (event, d: d3.HierarchyPointNode<FamilyMember>) => {
          event.preventDefault();
          event.stopPropagation();
          if(d.data.relation === 'SystemRoot') return;
          
          // Select the node first for visual feedback
          onNodeClick(d.data);
          
          // Open custom context menu
          setContextMenu({ 
              x: event.clientX, 
              y: event.clientY, 
              member: d.data 
          });
      })
      .style("opacity", (d: d3.HierarchyPointNode<FamilyMember>) => {
         if (!isVisibleInTime(d.data)) return 0.05;
         if (d.data.relation === 'SystemRoot') return 0;
         if (!hasHighlight) return 1;
         return highlightedIds.has(d.data.id) ? 1 : 0.2; 
      });

    // Node Circle Background (Neutral)
    node.append("circle")
      .attr("r", 30)
      .attr("fill", colors.nodeFill)
      .attr("stroke", (d: any) => {
          if (selectedId === d.data.id) return colors.selectedRing;
          return colors.nodeStroke;
      })
      .attr("stroke-width", (d: any) => selectedId === d.data.id ? "4px" : "2px")
      .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.1))")
      .style("transition", "all 0.3s ease");

    // Clip Path for Images
    const clipPathId = (d: any) => `clip-${d.data.id}`;
    node.append("clipPath")
      .attr("id", clipPathId)
      .append("circle")
      .attr("r", 28);

    // Node Image or Gender Icon
    node.each(function(d: d3.HierarchyPointNode<FamilyMember>) {
        const el = d3.select(this);
        if (d.data.imageUrl) {
            el.append("image")
              .attr("xlink:href", d.data.imageUrl)
              .attr("x", -28)
              .attr("y", -28)
              .attr("width", 56)
              .attr("height", 56)
              .attr("clip-path", `url(#${clipPathId(d)})`)
              .attr("preserveAspectRatio", "xMidYMid slice");
        } else {
            // Draw Gender Icon if no image
            // Scale up for better visibility inside the 30px radius circle
            const iconScale = 1.5; 
            const iconSize = 24 * iconScale;
            const offset = -iconSize / 2;
            
            // Determine icon and color based on gender
            let iconPath = MALE_ICON; // Default
            let iconColor = colors.maleIcon;

            if (d.data.gender === 'female') {
                iconPath = FEMALE_ICON;
                iconColor = colors.femaleIcon;
            } else if (d.data.gender === 'other') {
                // Keep default or use specific other icon if needed, currently reusing male icon as generic
                iconPath = MALE_ICON;
                iconColor = colors.textSecondary;
            }

            el.append("path")
              .attr("d", iconPath)
              .attr("fill", iconColor)
              .attr("transform", `translate(${offset}, ${offset}) scale(${iconScale})`);
        }

        // Add Heart Icon if spouse exists
        if (d.data.connections && d.data.connections.some(c => c.label === 'همسر')) {
             el.append("circle")
               .attr("r", 8)
               .attr("cx", 22)
               .attr("cy", 22)
               .attr("fill", colors.nodeFill)
               .attr("stroke", colors.linkSpouse)
               .attr("stroke-width", 1);

             el.append("g")
               .attr("transform", "translate(16, 16) scale(0.5)")
               .html(`<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${colors.linkSpouse}"/>`);
        }
    });

    // Node Name
    node.append("text")
      .attr("dy", 45)
      .attr("text-anchor", "middle")
      .text((d: any) => d.data.name)
      .style("font-family", "Vazirmatn")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("fill", colors.text)
      .style("text-shadow", "0px 1px 2px rgba(255,255,255,0.8)");

    // Node Date
    node.append("text")
      .attr("dy", 58)
      .attr("text-anchor", "middle")
      .text((d: any) => d.data.birthDate ? d.data.birthDate.split('/')[0] : '')
      .style("font-family", "monospace")
      .style("font-size", "10px")
      .style("fill", colors.textSecondary);

  }, [data, dimensions, orientation, theme, highlightedIds, linkStyle, preventOverlap, currentYear]);

  // Handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.8);
    }
  };

  const handleFit = () => {
      if (!svgRef.current || !zoomRef.current) return;
      const rootG = d3.select(svgRef.current).select('g');
      // @ts-ignore
      const bounds = rootG.node()?.getBBox();
      if (!bounds) return;

      const parent = svgRef.current.parentElement;
      if (!parent) return;

      const fullWidth = parent.clientWidth;
      const fullHeight = parent.clientHeight;
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;

      if (bounds.width === 0 || bounds.height === 0) return;

      const scale = 0.85 / Math.max(bounds.width / fullWidth, bounds.height / fullHeight);
      const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(
            // @ts-ignore
            zoomRef.current.transform, 
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
  };

  const glassClass = theme === 'dark' ? 'glass-panel-dark' : 'glass-panel';

  // --- Context Menu Handler Functions ---
  const handleMenuAction = (action: () => void) => {
      action();
      setContextMenu(null);
  };

  return (
    <div ref={wrapperRef} className="w-full h-full relative overflow-hidden bg-transparent" onContextMenu={(e) => e.preventDefault()}>
      <svg ref={svgRef} className="w-full h-full touch-none" />

      {/* Floating Toolbar */}
      <div className={`absolute bottom-6 right-6 flex flex-col gap-2 p-2 rounded-xl shadow-xl transition-all ${glassClass}`}>
        <button onClick={handleFit} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors" title="وسط چین"><Maximize size={20} /></button>
        <button onClick={handleZoomIn} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors"><ZoomIn size={20} /></button>
        <button onClick={handleZoomOut} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors"><ZoomOut size={20} /></button>
        <div className="h-px bg-slate-300 dark:bg-slate-600 my-1 mx-2"></div>
        <button onClick={() => onOrientationChange('vertical')} className={`p-2 rounded-lg transition-colors ${orientation === 'vertical' ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-teal-500/20 text-teal-600'}`} title="عمودی"><ArrowDown size={20} /></button>
        <button onClick={() => onOrientationChange('horizontal')} className={`p-2 rounded-lg transition-colors ${orientation === 'horizontal' ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-teal-500/20 text-teal-600'}`} title="افقی"><ArrowRight size={20} /></button>
        <div className="h-px bg-slate-300 dark:bg-slate-600 my-1 mx-2"></div>
        <button onClick={() => setLinkStyle(linkStyle === 'curved' ? 'straight' : 'curved')} className={`p-2 rounded-lg transition-colors ${linkStyle === 'curved' ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-teal-500/20 text-teal-600'}`} title="تغییر نوع خط"><GitBranch size={20} /></button>
        <button onClick={() => setPreventOverlap(!preventOverlap)} className={`p-2 rounded-lg transition-colors ${preventOverlap ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-teal-500/20 text-teal-600'}`} title="جلوگیری از تداخل"><GitMerge size={20} /></button>
      </div>

      {/* Custom Context Menu */}
      {contextMenu && (
          <div 
            className={`fixed z-[2001] rounded-xl shadow-2xl p-2 min-w-[200px] context-menu-enter ${glassClass} border ${theme === 'dark' ? 'border-slate-700 text-slate-200' : 'border-slate-100 text-slate-700'}`}
            style={{ top: contextMenu.y + 10, left: contextMenu.x + 10 }} // Slight offset
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
              <div className="px-3 py-2 text-xs font-bold opacity-50 border-b border-dashed border-slate-300 dark:border-slate-600 mb-1">
                  {contextMenu.member.name}
              </div>

              <button onClick={() => handleMenuAction(() => onOpenDetails(contextMenu.member))} className="w-full text-right px-3 py-2.5 hover:bg-teal-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors">
                  <User size={16} className="text-teal-500"/> مشاهده پروفایل
              </button>
              
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>

              <button onClick={() => handleMenuAction(() => onAddChild && onAddChild(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-teal-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors">
                  <Plus size={16}/> افزودن فرزند
              </button>
              <button onClick={() => handleMenuAction(() => onAddSibling && onAddSibling(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-blue-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors">
                  <GitBranch size={16}/> افزودن هم‌سطح
              </button>
              <button onClick={() => handleMenuAction(() => onAddSpouse && onAddSpouse(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-pink-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors text-pink-500 font-medium">
                  <Heart size={16}/> ثبت همسر / ازدواج
              </button>

              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>

              <button onClick={() => handleMenuAction(() => onDeleteMember && onDeleteMember(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-red-500/10 text-red-500 rounded-lg flex items-center gap-2 text-sm transition-colors">
                  <Trash2 size={16}/> حذف عضو
              </button>
              <button onClick={() => setContextMenu(null)} className="w-full text-right px-3 py-2.5 hover:bg-slate-500/10 text-slate-400 rounded-lg flex items-center gap-2 text-xs transition-colors mt-1">
                  <XCircle size={14}/> بستن منو
              </button>
          </div>
      )}

      {/* Quick Action Floating Menu (Only shows if Context Menu is CLOSED) */}
      {selectedNodePos && !contextMenu && (
         <div 
            className="absolute z-40 flex flex-col gap-2 context-menu-enter"
            style={{ 
                left: selectedNodePos.x, 
                top: selectedNodePos.y, 
                transform: 'translate(-50%, -100%) translateY(-50px)' 
            }}
         >
             <div className={`flex gap-2 p-2 rounded-full shadow-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                 <button onClick={() => { if(selectedId) { onOpenDetails(nodeMapRef.current.get(selectedId)?.data!); } }} className="p-2 rounded-full hover:bg-teal-50 text-teal-600 transition-colors" title="مشاهده پروفایل"><User size={18}/></button>
                 <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                 <button onClick={() => { if(selectedId && onAddChild) onAddChild(selectedId); }} className="p-2 rounded-full hover:bg-teal-50 text-teal-600 transition-colors" title="افزودن فرزند"><Plus size={18}/></button>
                 <button onClick={() => { if(selectedId && onAddSibling) onAddSibling(selectedId); }} className="p-2 rounded-full hover:bg-blue-50 text-blue-600 transition-colors" title="افزودن هم‌سطح"><GitBranch size={18}/></button>
                 <button onClick={() => { if(selectedId && onAddSpouse) onAddSpouse(selectedId); }} className="p-2 rounded-full hover:bg-pink-50 text-pink-500 transition-colors" title="افزودن همسر"><Heart size={18}/></button>
             </div>
         </div>
      )}
    </div>
  );
};

export default FamilyTree;
