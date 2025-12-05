
import React, { useEffect, useRef, useState } from 'react';
import { 
  select, 
  zoom as d3Zoom, 
  zoomIdentity, 
  tree as d3Tree, 
  hierarchy,
  easeQuadOut,
  easeElasticOut
} from 'd3';
import { FamilyMember, AppTheme, TreeSettings } from '../types';
import { ZoomIn, ZoomOut, ArrowDown, ArrowRight, User, Plus, Trash2, GitBranch, GitMerge, XCircle, Heart } from 'lucide-react';

// Define loose types for d3 structures
type HierarchyPointNode<T> = any;
type ZoomBehavior<Element, Datum> = any;

// SVG Paths for Gender Icons
const MALE_ICON = "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z";
const FEMALE_ICON = "M12,4A4,4 0 0,1 16,8C16,9.95 14.6,11.58 12.75,11.93L12.75,12.09C12.75,12.09 16,13.67 16,18V20H8V18C8,13.9 11.25,12.09 11.25,12.09L11.25,11.93C9.4,11.58 8,9.95 8,8A4,4 0 0,1 12,4Z";

// Branch Colors Palette
const BRANCH_COLORS = ['#0d9488', '#d97706', '#e11d48', '#4f46e5', '#0891b2', '#7c3aed'];

interface FamilyTreeProps {
  data: FamilyMember;
  onNodeClick: (member: FamilyMember, event: React.MouseEvent) => void;
  onOpenDetails: (member: FamilyMember) => void;
  selectedIds: Set<string>;
  orientation: 'horizontal' | 'vertical';
  onOrientationChange: (orientation: 'horizontal' | 'vertical') => void;
  theme: AppTheme;
  highlightedIds: Set<string>;
  onAddChild?: (parentId: string) => void;
  onAddSibling?: (memberId: string) => void;
  onAddSpouse?: (memberId: string) => void;
  onDeleteMember?: (id: string) => void;
  currentYear?: number;
  treeSettings: TreeSettings;
  onSettingsChange?: (settings: Partial<TreeSettings>) => void;
}

const FamilyTree: React.FC<FamilyTreeProps> = ({ 
  data, 
  onNodeClick, 
  onOpenDetails,
  selectedIds, 
  orientation,
  onOrientationChange,
  theme,
  highlightedIds,
  onAddChild,
  onAddSibling,
  onAddSpouse,
  onDeleteMember,
  currentYear,
  treeSettings,
  onSettingsChange
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomTransform, setZoomTransform] = useState(zoomIdentity.translate(120, 80));
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  const [selectedNodePos, setSelectedNodePos] = useState<{x: number, y: number} | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, member: FamilyMember} | null>(null);
  
  const nodeMapRef = useRef<Map<string, HierarchyPointNode<FamilyMember>>>(new Map());

  // Helper to extract year from date string
  const getBirthYear = (dateStr?: string): number => {
      if (!dateStr) return -1;
      const part = dateStr.split('/')[0];
      const year = parseInt(part);
      return isNaN(year) ? -1 : year;
  };

  const calculateAge = (birthDate?: string, deathDate?: string): string => {
      if (!birthDate) return '';
      const bYear = getBirthYear(birthDate);
      if (bYear === -1) return '';

      if (deathDate) {
          const dYear = getBirthYear(deathDate);
          if (dYear !== -1) return `(${dYear - bYear})`;
          return '†';
      }
      const now = new Date();
      const currentShamsiYear = currentYear || (now.getFullYear() - 621);
      const age = currentShamsiYear - bYear;
      if (age < 0) return '';
      return `(${age})`;
  };

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
          selectedRing: '#2dd4bf',
          shadow: 'rgba(0,0,0,0.5)'
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
          selectedRing: '#0f766e',
          shadow: 'rgba(0,0,0,0.1)'
        };
    }
  };

  // Organize Data (Spouse Logic)
  const organizeData = (inputData: FamilyMember) => {
    const clonedData = JSON.parse(JSON.stringify(inputData));
    if (!clonedData.children) return clonedData;

    const idMap = new Map<string, any>();
    const parentMap = new Map<string, any>();

    const traverse = (node: any, parent: any) => {
        idMap.set(node.id, node);
        if (parent) parentMap.set(node.id, parent);
        if (node.children) {
            node.children.forEach((c: any) => traverse(c, node));
        }
    };
    traverse(clonedData, null);

    if (clonedData.relation === 'SystemRoot') {
        const rootChildren = [...(clonedData.children || [])];
        const nodesToRemoveFromRoot = new Set<string>();

        rootChildren.forEach((rootChild: any) => {
            const spouseConn = rootChild.connections?.find((c: any) => c.label === 'همسر');
            if (spouseConn) {
                const partnerId = spouseConn.targetId;
                const partnerParent = parentMap.get(partnerId);

                if (partnerParent && partnerParent.id !== clonedData.id) {
                    if (!partnerParent.children) partnerParent.children = [];
                    const idx = partnerParent.children.findIndex((c: any) => c.id === partnerId);
                    if (idx !== -1) {
                        partnerParent.children.splice(idx + 1, 0, rootChild);
                    } else {
                        partnerParent.children.push(rootChild);
                    }
                    rootChild._isMoved = true;
                    nodesToRemoveFromRoot.add(rootChild.id);
                }
            }
        });
        clonedData.children = clonedData.children.filter((c: any) => !nodesToRemoveFromRoot.has(c.id));
    }

    const recursiveSort = (node: any) => {
        if (node.children && node.children.length > 0) {
            const sorted: any[] = [];
            const visited = new Set<string>();
            const childMap = new Map(node.children.map((c: any) => [c.id, c]));

            node.children.forEach((child: any) => {
                if (visited.has(child.id)) return;
                sorted.push(child);
                visited.add(child.id);

                if (child.connections) {
                    child.connections.forEach((conn: any) => {
                        if (conn.label === 'همسر' && childMap.has(conn.targetId) && !visited.has(conn.targetId)) {
                            sorted.push(childMap.get(conn.targetId));
                            visited.add(conn.targetId);
                        }
                    });
                }
            });
            node.children = sorted;
            node.children.forEach(recursiveSort);
        }
    };

    recursiveSort(clonedData);
    return clonedData;
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

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              const activeTag = document.activeElement?.tagName;
              if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
              e.preventDefault();
              handleFit();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomTransform]);

  useEffect(() => {
      const lastSelectedId = Array.from(selectedIds).pop();
      if (lastSelectedId && nodeMapRef.current.has(lastSelectedId) && !contextMenu) {
        const sNode = nodeMapRef.current.get(lastSelectedId);
        if (sNode) {
            const t = zoomTransform;
            const x = orientation === 'horizontal' ? sNode.y : sNode.x;
            const y = orientation === 'horizontal' ? sNode.x : sNode.y;
            const finalX = t.x + x * t.k; 
            const finalY = t.y + y * t.k;
            setSelectedNodePos({ x: finalX, y: finalY });
        }
      } else {
        setSelectedNodePos(null);
      }
  }, [selectedIds, zoomTransform, orientation, dimensions, contextMenu]);

  // --- D3 Drawing Logic ---
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const colors = getThemeColors(theme);
    const hasHighlight = highlightedIds.size > 0;
    
    const { 
        isCompact, 
        fontStyle, 
        colorMode, 
        showGenerationLabels, 
        showAvatars, 
        showSpouseConnections, 
        showParentChildConnections, 
        showLabels, 
        showDates, 
        showAge,
        linkStyle,
        preventOverlap,
        // New Settings
        nodeShape,
        siblingSpacing,
        levelSpacing,
        enableShadows,
        showTags,
        showConnectionLabels
    } = treeSettings;

    const isClassicFont = fontStyle === 'classic';
    const fontFamily = isClassicFont ? '"Noto Naskh Arabic", serif' : '"Vazirmatn", sans-serif';
    const isRect = nodeShape === 'rect';

    select(svgRef.current).selectAll("*").remove();
    const organizedData = organizeData(data);

    const svg = select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .on("click", () => setContextMenu(null));

    const g = svg.append("g")
      .attr("transform", zoomTransform.toString());

    const zoom = d3Zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
          if (event.transform.k === zoomTransform.k && 
              event.transform.x === zoomTransform.x && 
              event.transform.y === zoomTransform.y) return;
          g.attr("transform", event.transform);
          setZoomTransform(event.transform);
          setContextMenu(null);
        });

    svg.call(zoom);
    zoomRef.current = zoom;

    // --- Dynamic Sizing ---
    const baseNodeWidth = isRect ? 140 : (isCompact ? 50 : 90);
    const baseNodeHeight = isRect ? 70 : (isCompact ? 120 : 240); // Used for nodeSize calculation
    const separationFactor = siblingSpacing || 1.2;
    const levelDistance = levelSpacing || (isCompact ? 120 : 180);

    let treemap;
    // nodeSize is [width, height]
    const effectiveNodeSize: [number, number] = orientation === 'horizontal' 
        ? [baseNodeHeight * 0.5, levelDistance]  // In horizontal, y is depth
        : [baseNodeWidth * separationFactor, levelDistance];

    if (orientation === 'horizontal') {
        treemap = d3Tree<FamilyMember>()
            .nodeSize([isRect ? 90 : baseNodeWidth * separationFactor, levelDistance]) 
            .separation((a: any, b: any) => {
                // Determine if siblings or cousins
                const isSpouse = a.data.connections?.some((c: any) => c.targetId === b.data.id && c.label === 'همسر');
                let sep = isSpouse ? 0.75 : (a.parent === b.parent ? 1.1 : 1.4);
                return sep * separationFactor; 
            });
    } else {
        treemap = d3Tree<FamilyMember>()
            .nodeSize([baseNodeWidth, levelDistance])
            .separation((a: any, b: any) => {
                const isSpouse = a.data.connections?.some((c: any) => c.targetId === b.data.id && c.label === 'همسر');
                let sep = isSpouse ? 0.75 : (a.parent === b.parent ? 1.1 : 1.4);
                return sep * separationFactor;
            });
    }

    const root = hierarchy(organizedData, (d) => d.children);
    // @ts-ignore
    const nodes = treemap(root);
    nodeMapRef.current.clear();
    
    // Assign Colors & Map
    nodes.descendants().forEach((d: any) => {
        if (colorMode === 'branch') {
            if (d.depth === 0) {
                d._branchColor = colors.nodeStroke;
            } else if (d.depth === 1) {
                const index = d.parent.children.indexOf(d);
                d._branchColor = BRANCH_COLORS[index % BRANCH_COLORS.length];
                d._branchIndex = index;
            } else {
                d._branchColor = d.parent._branchColor;
                d._branchIndex = d.parent._branchIndex;
            }
        }
        nodeMapRef.current.set(d.data.id, d);
    });

    // --- Links ---
    const customLinkGenerator = (d: any) => {
        let s = d.source;
        let t = d.target;
        
        // Spouse centering logic
        if (s.data.connections && s.data.connections.some((c: any) => c.label === 'همسر')) {
            const spouseConn = s.data.connections.find((c: any) => c.label === 'همسر');
            const spouseNode = nodeMapRef.current.get(spouseConn.targetId);
            if (spouseNode) {
                 const midX = (s.x + spouseNode.x) / 2;
                 const midY = (s.y + spouseNode.y) / 2;
                 s = { x: midX, y: midY };
            }
        }

        if (linkStyle === 'straight') {
             return orientation === 'horizontal'
                ? `M${s.y},${s.x} L${t.y},${t.x}` 
                : `M${s.x},${s.y} L${t.x},${t.y}`;
        }

        if (linkStyle === 'step') {
            if (orientation === 'horizontal') {
                const midY = (s.y + t.y) / 2;
                return `M${s.y},${s.x} L${midY},${s.x} L${midY},${t.x} L${t.y},${t.x}`;
            } else {
                const midY = (s.y + t.y) / 2;
                return `M${s.x},${s.y} L${s.x},${midY} L${t.x},${midY} L${t.x},${t.y}`;
            }
        }

        let offset = 0;
        if (preventOverlap) {
            const idVal = t.data.id ? t.data.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
            offset = ((idVal % 3) - 1) * 20; 
        }

        if (orientation === 'horizontal') {
            const mx = (s.y + t.y) / 2;
            return `M ${s.y} ${s.x} C ${mx} ${s.x + offset}, ${mx} ${t.x + offset}, ${t.y} ${t.x}`;
        } else {
            const my = (s.y + t.y) / 2;
            return `M ${s.x} ${s.y} C ${s.x + offset} ${my}, ${t.x + offset} ${my}, ${t.x} ${t.y}`;
        }
    };

    const gContent = g.append("g");

    // Extra Links (Non-Tree)
    const extraLinks: any[] = [];
    nodes.descendants().forEach((sourceNode: any) => {
      if (sourceNode.data.connections) {
        sourceNode.data.connections.forEach((conn: any) => {
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

    const visibleExtraLinks = extraLinks.filter(d => {
        if (d.label === 'همسر' && !showSpouseConnections) return false;
        return true;
    });

    // Draw Extra Links
    gContent.selectAll(".extra-link")
      .data(visibleExtraLinks)
      .enter().append("path")
      .attr("class", "extra-link")
      .attr("d", (d: any) => {
          const s = d.source;
          const t = d.target;
          // Simple Straight or Curve
          if (orientation === 'horizontal') {
              const mx = (s.y + t.y) / 2;
              return `M ${s.y} ${s.x} Q ${mx} ${(s.x + t.x)/2} ${t.y} ${t.x}`;
          } else {
              const my = (s.y + t.y) / 2;
              return `M ${s.x} ${s.y} Q ${(s.x + t.x)/2} ${my} ${t.x} ${t.y}`;
          }
      })
      .attr("fill", "none")
      .attr("stroke", (d: any) => d.label === 'همسر' ? colors.linkSpouse : colors.linkExtra)
      .attr("stroke-width", "2px")
      .attr("stroke-dasharray", (d: any) => d.label === 'همسر' ? "0" : "5,5")
      .attr("opacity", (d: any) => {
         if (!isVisibleInTime(d.source.data) || !isVisibleInTime(d.target.data)) return 0;
         return hasHighlight ? (highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id) ? 1 : 0.1) : 0.6;
      });
      
    // Connection Labels
    if (showConnectionLabels) {
        gContent.selectAll(".extra-link-label")
            .data(visibleExtraLinks)
            .enter().append("text")
            .attr("x", (d: any) => orientation === 'horizontal' ? (d.source.y + d.target.y)/2 : (d.source.x + d.target.x)/2)
            .attr("y", (d: any) => orientation === 'horizontal' ? (d.source.x + d.target.x)/2 : (d.source.y + d.target.y)/2)
            .attr("dy", -5)
            .attr("text-anchor", "middle")
            .text((d: any) => d.label)
            .style("font-size", "9px")
            .style("fill", colors.linkExtra)
            .style("opacity", (d: any) => hasHighlight ? (highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id) ? 1 : 0) : 0.8)
            .style("font-family", fontFamily);
    }

    // Tree Links
    const visibleLinks = nodes.links().filter((d: any) => {
        if (d.source.data.relation === 'SystemRoot') return false;
        if (!showParentChildConnections) return false;
        // @ts-ignore
        if (d.target.data._isMoved) return false; 
        return true;
    });

    gContent.selectAll(".link")
      .data(visibleLinks)
      .enter().append("path")
      .attr("class", "link")
      .attr("d", customLinkGenerator)
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
          if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return colors.selectedRing;
          if (colorMode === 'branch' && d.target._branchColor) return d.target._branchColor;
          return colors.link;
      })
      .attr("stroke-width", (d: any) => {
         if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return "3px";
         return "1.5px";
      })
      .style("opacity", (d: any) => {
         if (!isVisibleInTime(d.source.data) || !isVisibleInTime(d.target.data)) return 0;
         if (hasHighlight && !(highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id))) return 0.1;
         return 1;
      });

    // --- NODES ---
    const node = gContent.selectAll(".node")
      .data(nodes.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => orientation === 'horizontal' ? `translate(${d.y},${d.x})` : `translate(${d.x},${d.y})`)
      .style("cursor", "pointer")
      .on("click", (event: any, d: HierarchyPointNode<FamilyMember>) => {
        if(d.data.relation === 'SystemRoot') return;
        event.stopPropagation();
        onNodeClick(d.data, event);
      })
      .on("dblclick", (event: any, d: HierarchyPointNode<FamilyMember>) => {
          if(d.data.relation === 'SystemRoot') return;
          event.stopPropagation();
          onOpenDetails(d.data);
      })
      .on("contextmenu", (event: any, d: HierarchyPointNode<FamilyMember>) => {
          event.preventDefault();
          event.stopPropagation();
          if(d.data.relation === 'SystemRoot') return;
          onNodeClick(d.data, event);
          setContextMenu({ 
              x: event.clientX, 
              y: event.clientY, 
              member: d.data 
          });
      })
      .style("opacity", (d: HierarchyPointNode<FamilyMember>) => {
         if (!isVisibleInTime(d.data)) return 0.05;
         if (d.data.relation === 'SystemRoot') return 0;
         if (!hasHighlight) return 1;
         return highlightedIds.has(d.data.id) ? 1 : 0.2; 
      });

    // Node Animation Group
    const animatedNode = node.append("g").attr("class", "animate-fade-in-scale");

    // === SHAPE RENDERING === //
    const clipPathId = (d: any) => `clip-${d.data.id}`;
    const rectW = 140;
    const rectH = 60;

    animatedNode.each(function(d: any) {
        const el = select(this);
        const isSelected = selectedIds.has(d.data.id);
        const color = (colorMode === 'branch' && d._branchColor) ? d._branchColor : colors.nodeStroke;
        
        // 1. Selection Rings
        if (isSelected) {
            if (isRect) {
                el.append("rect")
                  .attr("width", rectW + 8).attr("height", rectH + 8)
                  .attr("x", -(rectW/2) - 4).attr("y", -(rectH/2) - 4)
                  .attr("rx", 16)
                  .attr("fill", "none")
                  .attr("stroke", colors.selectedRing)
                  .attr("stroke-width", 2)
                  .attr("stroke-dasharray", "5,3");
            } else {
                el.insert("circle", ":first-child")
                  .attr("r", isCompact ? 20 : 30)
                  .attr("fill", colors.selectedRing)
                  .attr("fill-opacity", 0.2)
                  .attr("class", "animate-pulse-ring");
                el.append("circle")
                  .attr("r", isCompact ? 23 : 33)
                  .attr("fill", "none")
                  .attr("stroke", colors.selectedRing)
                  .attr("stroke-width", "1.5px")
                  .attr("stroke-dasharray", "4,3");
            }
        }

        // 2. Main Shape (Rect or Circle)
        if (isRect) {
            el.append("rect")
              .attr("width", rectW).attr("height", rectH)
              .attr("x", -rectW/2).attr("y", -rectH/2)
              .attr("rx", 12)
              .attr("fill", colors.nodeFill)
              .attr("stroke", isSelected ? colors.selectedRing : color)
              .attr("stroke-width", isSelected ? 3 : 2)
              .style("filter", enableShadows ? `drop-shadow(0px 4px 6px ${colors.shadow})` : "none");
              
            // Image Clip Path for Rect
            el.append("clipPath").attr("id", clipPathId(d)).append("circle").attr("r", 22).attr("cx", -rectW/2 + 30).attr("cy", 0);
            
            // Image / Icon
            const shouldShowAvatar = (showAvatars ?? true);
            if (d.data.imageUrl && shouldShowAvatar) {
                 el.append("image")
                  .attr("xlink:href", d.data.imageUrl)
                  .attr("x", -rectW/2 + 8)
                  .attr("y", -22)
                  .attr("width", 44)
                  .attr("height", 44)
                  .attr("clip-path", `url(#${clipPathId(d)})`)
                  .attr("preserveAspectRatio", "xMidYMid slice");
            } else {
                 const iconColor = (d.data.gender === 'female' ? colors.femaleIcon : colors.maleIcon);
                 el.append("circle").attr("r", 22).attr("cx", -rectW/2 + 30).attr("cy", 0).attr("fill", iconColor + '20'); // Light BG
                 el.append("path")
                   .attr("d", d.data.gender === 'female' ? FEMALE_ICON : MALE_ICON)
                   .attr("fill", iconColor)
                   .attr("transform", `translate(${-rectW/2 + 18}, -12) scale(1)`);
            }

            // Text Info (Right Side)
            if (showLabels) {
                el.append("text")
                  .attr("x", -10)
                  .attr("y", -5)
                  .attr("text-anchor", "middle")
                  .text(d.data.name)
                  .style("font-family", fontFamily)
                  .style("font-size", "12px")
                  .style("font-weight", "bold")
                  .style("fill", colors.text);
            }
            if (showDates) {
                const birth = d.data.birthDate ? d.data.birthDate.split('/')[0] : '';
                const ageText = showAge ? calculateAge(d.data.birthDate, d.data.deathDate) : '';
                el.append("text")
                  .attr("x", -10)
                  .attr("y", 12)
                  .attr("text-anchor", "middle")
                  .text(birth + ' ' + ageText)
                  .style("font-family", "monospace")
                  .style("font-size", "10px")
                  .style("fill", colors.textSecondary);
            }
            
            // Tags (Bottom Right)
            if (showTags && d.data.tags && d.data.tags.length > 0) {
                 const tag = d.data.tags[0]; // Show first tag only in compact rect
                 el.append("rect")
                   .attr("x", 20).attr("y", 15)
                   .attr("width", 40).attr("height", 12)
                   .attr("rx", 4)
                   .attr("fill", tag.color)
                   .attr("opacity", 0.8);
                 el.append("text")
                   .attr("x", 40).attr("y", 24)
                   .attr("text-anchor", "middle")
                   .text(tag.label)
                   .style("font-size", "8px")
                   .style("fill", "#fff");
            }

        } else {
            // CIRCLE MODE (Classic)
            el.append("circle")
              .attr("r", isCompact ? 20 : 30)
              .attr("fill", colors.nodeFill)
              .attr("stroke", isSelected ? colors.selectedRing : color)
              .attr("stroke-width", isSelected ? "3px" : "2px")
              .style("filter", enableShadows ? `drop-shadow(0px 4px 6px ${colors.shadow})` : "none");

            el.append("clipPath").attr("id", clipPathId(d)).append("circle").attr("r", isCompact ? 18 : 28);

            const shouldShowAvatar = (showAvatars ?? true) && !isCompact;
            if (d.data.imageUrl && shouldShowAvatar) {
                el.append("image")
                  .attr("xlink:href", d.data.imageUrl)
                  .attr("x", isCompact ? -18 : -28)
                  .attr("y", isCompact ? -18 : -28)
                  .attr("width", isCompact ? 36 : 56)
                  .attr("height", isCompact ? 36 : 56)
                  .attr("clip-path", `url(#${clipPathId(d)})`)
                  .attr("preserveAspectRatio", "xMidYMid slice");
            } else {
                const iconScale = isCompact ? 1.0 : 1.5; 
                const iconSize = 24 * iconScale;
                const offset = -iconSize / 2;
                
                let iconPath = MALE_ICON; 
                let iconColor = colors.maleIcon;
                if (colorMode === 'branch' && d._branchColor) iconColor = d._branchColor;
                else if (d.data.gender === 'female') { iconPath = FEMALE_ICON; iconColor = colors.femaleIcon; }

                el.append("path")
                  .attr("d", iconPath)
                  .attr("fill", iconColor)
                  .attr("transform", `translate(${offset}, ${offset}) scale(${iconScale})`);
            }
            
            // Labels for Circle
             if (showLabels) {
                const textY = isCompact ? 32 : 45;
                el.append("text")
                  .attr("dy", textY)
                  .attr("text-anchor", "middle")
                  .text(d.data.name)
                  .style("font-family", fontFamily)
                  .style("font-size", isCompact ? "10px" : "12px")
                  .style("font-weight", "bold")
                  .style("fill", colors.text)
                  .style("text-shadow", "0px 1px 2px rgba(255,255,255,0.8)");
            }
            if (showDates) {
                const dateY = isCompact ? 42 : 58;
                el.append("text")
                  .attr("dy", dateY)
                  .attr("text-anchor", "middle")
                  .text(() => {
                      const birth = d.data.birthDate ? d.data.birthDate.split('/')[0] : '';
                      const age = showAge ? calculateAge(d.data.birthDate, d.data.deathDate) : '';
                      return birth + ' ' + age;
                  })
                  .style("font-family", "monospace")
                  .style("font-size", "10px")
                  .style("fill", colors.textSecondary);
            }
            
            // Tags for Circle (Little dots or pills below)
            if (showTags && d.data.tags) {
                const tagY = isCompact ? 50 : 68;
                d.data.tags.forEach((tag: any, i: number) => {
                    if (i > 2) return; // Limit tags
                    el.append("circle")
                      .attr("cx", (i - (d.data.tags.length-1)/2) * 8)
                      .attr("cy", tagY)
                      .attr("r", 3)
                      .attr("fill", tag.color);
                });
            }
        }
    });

  }, [data, dimensions, orientation, theme, highlightedIds, currentYear, treeSettings, selectedIds]);

  // Handle Zoom/Pan Actions
  const handleZoomIn = () => { if (svgRef.current && zoomRef.current) select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.2); };
  const handleZoomOut = () => { if (svgRef.current && zoomRef.current) select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.8); };
  const handleFit = () => {
      if (!svgRef.current || !zoomRef.current) return;
      const rootG = select(svgRef.current).select('g');
      // @ts-ignore
      const bounds = rootG.node()?.getBBox();
      if (!bounds) return;
      const parent = svgRef.current.parentElement;
      if (!parent) return;
      const fullWidth = parent.clientWidth;
      const fullHeight = parent.clientHeight;
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;
      if (bounds.width === 0) return;
      const scale = 0.85 / Math.max(bounds.width / fullWidth, bounds.height / fullHeight);
      select(svgRef.current).transition().duration(750).call(
            // @ts-ignore
            zoomRef.current.transform, 
            zoomIdentity.translate(fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY).scale(scale)
      );
  };

  const glassClass = theme === 'dark' ? 'glass-panel-dark' : 'glass-panel';
  const handleMenuAction = (action: () => void) => { action(); setContextMenu(null); };

  return (
    <div ref={wrapperRef} className="w-full h-full relative overflow-hidden bg-transparent" onContextMenu={(e) => e.preventDefault()}>
      <svg ref={svgRef} className="w-full h-full touch-none" />

      {/* Floating Toolbar */}
      <div className={`absolute bottom-6 right-6 flex flex-col gap-2 p-2 rounded-xl shadow-xl transition-all animate-slide-up ${glassClass}`}>
        <button onClick={handleFit} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors" title="Fit"><User size={20} /></button>
        <button onClick={handleZoomIn} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors"><ZoomIn size={20} /></button>
        <button onClick={handleZoomOut} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors"><ZoomOut size={20} /></button>
        <div className="h-px bg-slate-300 dark:bg-slate-600 my-1 mx-2"></div>
        <button onClick={() => onOrientationChange('vertical')} className={`p-2 rounded-lg transition-colors ${orientation === 'vertical' ? 'bg-teal-500 text-white' : 'hover:bg-teal-500/20 text-teal-600'}`}><ArrowDown size={20} /></button>
        <button onClick={() => onOrientationChange('horizontal')} className={`p-2 rounded-lg transition-colors ${orientation === 'horizontal' ? 'bg-teal-500 text-white' : 'hover:bg-teal-500/20 text-teal-600'}`}><ArrowRight size={20} /></button>
        <div className="h-px bg-slate-300 dark:bg-slate-600 my-1 mx-2"></div>
        <button onClick={() => onSettingsChange && onSettingsChange({ preventOverlap: !treeSettings.preventOverlap })} className={`p-2 rounded-lg transition-colors ${treeSettings.preventOverlap ? 'bg-teal-500 text-white' : 'hover:bg-teal-500/20 text-teal-600'}`}><GitMerge size={20} /></button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <div 
            className={`fixed z-[2001] rounded-xl shadow-2xl p-2 min-w-[200px] context-menu-enter ${glassClass} border ${theme === 'dark' ? 'border-slate-700 text-slate-200' : 'border-slate-100 text-slate-700'}`}
            style={{ top: contextMenu.y + 10, left: contextMenu.x + 10 }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
              <div className="px-3 py-2 text-xs font-bold opacity-50 border-b border-dashed border-slate-300 dark:border-slate-600 mb-1">{contextMenu.member.name}</div>
              <button onClick={() => handleMenuAction(() => onOpenDetails(contextMenu.member))} className="w-full text-right px-3 py-2.5 hover:bg-teal-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors"><User size={16} className="text-teal-500"/> مشاهده پروفایل</button>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
              <button onClick={() => handleMenuAction(() => onAddChild && onAddChild(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-teal-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors"><Plus size={16}/> افزودن فرزند</button>
              <button onClick={() => handleMenuAction(() => onAddSibling && onAddSibling(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-blue-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors"><GitBranch size={16}/> افزودن هم‌سطح</button>
              <button onClick={() => handleMenuAction(() => onAddSpouse && onAddSpouse(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-pink-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors text-pink-500"><Heart size={16}/> ثبت ازدواج</button>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
              <button onClick={() => handleMenuAction(() => onDeleteMember && onDeleteMember(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-red-500/10 text-red-500 rounded-lg flex items-center gap-2 text-sm transition-colors"><Trash2 size={16}/> حذف عضو</button>
              <button onClick={() => setContextMenu(null)} className="w-full text-right px-3 py-2.5 hover:bg-slate-500/10 text-slate-400 rounded-lg flex items-center gap-2 text-xs transition-colors mt-1"><XCircle size={14}/> بستن</button>
          </div>
      )}
    </div>
  );
};

export default FamilyTree;
