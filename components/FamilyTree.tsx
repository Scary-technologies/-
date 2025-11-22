
import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as d3 from 'd3';
import { FamilyMember, AppTheme, Tag } from '../types';
import { Maximize, ZoomIn, ZoomOut, Image as ImageIcon, GitMerge, Plus, GitBranch, Route, User } from 'lucide-react';

interface FamilyTreeProps {
  data: FamilyMember;
  onNodeClick: (member: FamilyMember) => void;
  onOpenDetails: (member: FamilyMember) => void;
  selectedId?: string | null;
  orientation: 'horizontal' | 'vertical';
  theme: AppTheme;
  highlightedIds: Set<string>;
  onAddChild?: (parentId: string) => void;
  onAddSibling?: (memberId: string) => void;
}

const FamilyTree: React.FC<FamilyTreeProps> = ({ 
  data, 
  onNodeClick, 
  onOpenDetails,
  selectedId, 
  orientation,
  theme,
  highlightedIds,
  onAddChild,
  onAddSibling
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomTransform, setZoomTransform] = useState(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [linkStyle, setLinkStyle] = useState<'curved' | 'straight'>('curved');
  const [preventOverlap, setPreventOverlap] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [selectedNodePos, setSelectedNodePos] = useState<{x: number, y: number} | null>(null);
  
  // Store node map in ref to access it without redrawing graph
  const nodeMapRef = useRef<Map<string, d3.HierarchyPointNode<FamilyMember>>>(new Map());

  // Theme configuration
  const getThemeColors = (theme: AppTheme) => {
    switch (theme) {
      case 'vintage':
        return {
          link: '#d3c6aa',
          linkExtra: '#cb4b16',
          maleGrad: ['#859900', '#859900'], // Olive
          femaleGrad: ['#b58900', '#b58900'], // Yellow/Gold
          text: '#433422',
          textSecondary: '#887a66',
          nodeStroke: '#586e75',
          bgLabel: '#fdf6e3',
          selectedRing: '#cb4b16'
        };
      case 'dark':
        return {
          link: '#475569',
          linkExtra: '#f59e0b',
          maleGrad: ['#1e40af', '#3b82f6'],
          femaleGrad: ['#831843', '#db2777'],
          text: '#f1f5f9',
          textSecondary: '#94a3b8',
          nodeStroke: '#fff',
          bgLabel: '#0f172a',
          selectedRing: '#2dd4bf'
        };
      case 'modern':
      default:
        return {
          link: '#94a3b8',
          linkExtra: '#f59e0b',
          maleGrad: ['#60a5fa', '#2563eb'],
          femaleGrad: ['#f472b6', '#db2777'],
          text: '#1e293b',
          textSecondary: '#64748b',
          nodeStroke: '#fff',
          bgLabel: 'rgba(255,255,255,0.9)',
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

  // Effect to calculate selectedNodePos independently from graph drawing
  useEffect(() => {
      if (selectedId && nodeMapRef.current.has(selectedId)) {
        const sNode = nodeMapRef.current.get(selectedId);
        if (sNode) {
            const t = zoomTransform;
            const x = orientation === 'horizontal' ? sNode.y : sNode.x;
            const y = orientation === 'horizontal' ? sNode.x : sNode.y;
            setSelectedNodePos({
                x: t.x + x * t.k + 120, // margin.left
                y: t.y + y * t.k + 80   // margin.top
            });
        }
      } else {
        setSelectedNodePos(null);
      }
  }, [selectedId, zoomTransform, orientation, dimensions]);

  // Main Graph Drawing Effect - DOES NOT depend on zoomTransform to prevent loop
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const colors = getThemeColors(theme);
    const hasHighlight = highlightedIds.size > 0;

    // Clear previous SVG
    d3.select(svgRef.current).selectAll("*").remove();

    const margin = { top: 80, right: 120, bottom: 80, left: 120 };
    const width = dimensions.width - margin.left - margin.right;
    
    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    // Define Gradients
    const defs = svg.append("defs");
    
    // Male Gradient
    const maleGrad = defs.append("linearGradient")
      .attr("id", "grad-male")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    maleGrad.append("stop").attr("offset", "0%").style("stop-color", colors.maleGrad[0]);
    maleGrad.append("stop").attr("offset", "100%").style("stop-color", colors.maleGrad[1]);

    // Female Gradient
    const femaleGrad = defs.append("linearGradient")
      .attr("id", "grad-female")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    femaleGrad.append("stop").attr("offset", "0%").style("stop-color", colors.femaleGrad[0]);
    femaleGrad.append("stop").attr("offset", "100%").style("stop-color", colors.femaleGrad[1]);

    const g = svg.append("g")
      .attr("class", "tree-group")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Apply current zoom immediately to the group
    g.attr("transform", zoomTransform.toString());

    // Define Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
          // Prevent infinite loop by checking if transform actually changed
          if (event.transform.k === zoomTransform.k && 
              event.transform.x === zoomTransform.x && 
              event.transform.y === zoomTransform.y) return;

          g.attr("transform", event.transform);
          setZoomTransform(event.transform);
        });

    svg.call(zoom);
    // Do not call zoom.transform here to avoid firing the event and causing a loop.
    // We just let D3 internal state be what it is, or we'd need to set it silently which isn't easy.
    // However, to ensure D3's internal state matches our state, we can do this on mount only, or verify.
    // For now, we assume the user interaction drives the state.
    // But if we want buttons to work, we need to sync.
    // We can sync by assigning the transform property to the selection node directly if needed.
    // Re-binding the transform to the element:
    if (svg.node()) {
        // @ts-ignore
        d3.zoomTransform(svg.node()).k = zoomTransform.k;
        // @ts-ignore
        d3.zoomTransform(svg.node()).x = zoomTransform.x;
        // @ts-ignore
        d3.zoomTransform(svg.node()).y = zoomTransform.y;
    }
    
    zoomRef.current = zoom;

    // Declare the tree layout
    let treemap;
    if (orientation === 'horizontal') {
        treemap = d3.tree<FamilyMember>()
            .nodeSize([90, 240]) // Increased vertical gap for separation
            .separation((a, b) => {
                // Extra separation between different sub-trees (clans)
                if (a.parent === b.parent) return 1.2;
                return 2.5; 
            });
    } else {
        treemap = d3.tree<FamilyMember>()
            .nodeSize([160, 160])
            .separation((a, b) => {
                if (a.parent === b.parent) return 1.2;
                return 2.5;
            });
    }

    const root = d3.hierarchy(data, (d) => d.children);
    // @ts-ignore
    const nodes = treemap(root);

    // Calculate Max Depth for Heatmap
    let maxDepth = 0;
    nodes.descendants().forEach(d => { if(d.depth > maxDepth) maxDepth = d.depth; });
    const heatmapColorScale = d3.scaleLinear<string>()
        .domain([0, maxDepth])
        .range(["#1e293b", "#cbd5e1"]);

    // Create a lookup for nodes
    nodeMapRef.current.clear();
    nodes.descendants().forEach(d => {
      nodeMapRef.current.set(d.data.id, d);
    });
    
    // Prepare extra connection links
    const extraLinks: { source: d3.HierarchyPointNode<FamilyMember>; target: d3.HierarchyPointNode<FamilyMember>; label: string }[] = [];
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

    // Custom Link Generator
    const customLinkGenerator = (d: d3.HierarchyPointLink<FamilyMember> | { source: d3.HierarchyPointNode<FamilyMember>, target: d3.HierarchyPointNode<FamilyMember> }) => {
        const s = d.source;
        const t = d.target;
        
        if (linkStyle === 'straight') {
             if (orientation === 'horizontal') {
                return `M${s.y},${s.x} L${s.y},${t.x} L${t.y},${t.x}`; 
             } else {
                return `M${s.x},${s.y} L${t.x},${s.y} L${t.x},${t.y}`;
             }
        }

        // Curved Logic
        let offset = 0;
        if (preventOverlap) {
            // Deterministic pseudo-random offset based on ID to separate overlapping lines
            const idVal = t.data.id ? t.data.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
            // Create 3 lanes: -15, 0, +15
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

    // *** CRITICAL CHANGE: Filter out links originating from SystemRoot ***
    const visibleLinks = nodes.links().filter(d => d.source.data.relation !== 'SystemRoot');

    // Draw Extra Links (Marriages/Connections)
    g.selectAll(".extra-link")
      .data(extraLinks)
      .enter().append("path")
      .attr("class", "extra-link")
      .attr("d", customLinkGenerator)
      .attr("fill", "none")
      .attr("stroke", colors.linkExtra) 
      .attr("stroke-width", "2px")
      .attr("stroke-dasharray", "5,5")
      .attr("opacity", (d: any) => {
         if (!hasHighlight) return 0.6;
         const srcHi = highlightedIds.has(d.source.data.id);
         const tgtHi = highlightedIds.has(d.target.data.id);
         return (srcHi && tgtHi) ? 1 : 0.1;
      });

    // Draw Standard Links (Filtered)
    g.selectAll(".link")
      .data(visibleLinks)
      .enter().append("path")
      .attr("class", "link")
      .attr("d", customLinkGenerator)
      .attr("fill", "none")
      .attr("stroke", (d: d3.HierarchyPointLink<FamilyMember>) => {
          if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) {
             return colors.selectedRing;
          }
          return colors.link;
      })
      .attr("stroke-width", (d: d3.HierarchyPointLink<FamilyMember>) => {
         if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) {
             return "3px";
         }
         return "1.5px";
      })
      .style("opacity", (d: d3.HierarchyPointLink<FamilyMember>) => {
         if (!hasHighlight) return 1;
         if (highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return 1;
         return 0.1;
      })
      .style("transition", "all 0.5s ease");

    // Nodes Group
    const node = g.selectAll(".node")
      .data(nodes.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", (d: d3.HierarchyPointNode<FamilyMember>) => {
          return orientation === 'horizontal' 
            ? "translate(" + d.y + "," + d.x + ")"
            : "translate(" + d.x + "," + d.y + ")";
      })
      .style("cursor", "pointer")
      .on("click", (event, d: d3.HierarchyPointNode<FamilyMember>) => {
        if(d.data.relation === 'SystemRoot') return;
        onNodeClick(d.data);
        event.stopPropagation();
      })
      .on("dblclick", (event, d: d3.HierarchyPointNode<FamilyMember>) => {
          if(d.data.relation === 'SystemRoot') return;
          onOpenDetails(d.data);
          event.stopPropagation();
      })
      .on("contextmenu", (event, d: d3.HierarchyPointNode<FamilyMember>) => {
          event.preventDefault();
          if(d.data.relation === 'SystemRoot') return;
          onNodeClick(d.data); 
      })
      .style("opacity", (d: d3.HierarchyPointNode<FamilyMember>) => {
         // *** CRITICAL: Completely hide SystemRoot ***
         if (d.data.relation === 'SystemRoot') return 0;
         if (!hasHighlight) return 1;
         return highlightedIds.has(d.data.id) ? 1 : 0.2; 
      })
      .style("transition", "opacity 0.4s ease")
      .style("pointer-events", (d: d3.HierarchyPointNode<FamilyMember>) => d.data.relation === 'SystemRoot' ? 'none' : 'all')
      // --- Hover Effects ---
      .on("mouseenter", function(event, d: d3.HierarchyPointNode<FamilyMember>) {
          if (d.data.relation === 'SystemRoot') return;
          
          const group = d3.select(this);
          
          // Scale background circle
          group.select(".node-bg")
            .transition().duration(300).ease(d3.easeBackOut)
            .attr("r", 32)
            .style("filter", "drop-shadow(0 8px 16px rgba(0,0,0,0.2))")
            .attr("stroke-width", "3px");

          // Scale image
          group.select(".node-img")
            .transition().duration(300).ease(d3.easeBackOut)
            .attr("x", -32).attr("y", -32)
            .attr("width", 64).attr("height", 64);
            
          // Lift label group
          group.select(".node-label-rect")
            .transition().duration(300)
            .attr("y", orientation === 'horizontal' ? 38 : 38);
            
          group.select(".node-label-text")
             .transition().duration(300)
             .attr("dy", orientation === 'horizontal' ? "55" : "55");

          group.select(".node-label-sub")
             .transition().duration(300)
             .attr("dy", orientation === 'horizontal' ? "70" : "70");
      })
      .on("mouseleave", function(event, d: d3.HierarchyPointNode<FamilyMember>) {
          if (d.data.relation === 'SystemRoot') return;
          
          const group = d3.select(this);
          
          group.select(".node-bg")
            .transition().duration(300).ease(d3.easeCubicOut)
            .attr("r", 26)
            .style("filter", null)
            .attr("stroke-width", "2px");

          group.select(".node-img")
            .transition().duration(300).ease(d3.easeCubicOut)
            .attr("x", -26).attr("y", -26)
            .attr("width", 52).attr("height", 52);
            
          group.select(".node-label-rect")
            .transition().duration(300)
            .attr("y", orientation === 'horizontal' ? 32 : 32);

          group.select(".node-label-text")
             .transition().duration(300)
             .attr("dy", orientation === 'horizontal' ? "49" : "49");

          group.select(".node-label-sub")
             .transition().duration(300)
             .attr("dy", orientation === 'horizontal' ? "64" : "64");
      });

    // 1. Selected State Ring
    node.filter((d: d3.HierarchyPointNode<FamilyMember>) => d.data.id === selectedId)
        .append("circle")
        .attr("r", 34)
        .attr("fill", "none")
        .attr("stroke", colors.selectedRing)
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "4,4")
        .attr("class", "animate-spin-slow");

    // 2. Main Circle Background
    node.append("circle")
      .attr("class", "node-bg")
      .attr("r", 26)
      .style("fill", (d: d3.HierarchyPointNode<FamilyMember>) => {
          if (heatmapMode) {
             return heatmapColorScale(d.depth);
          }
          return d.data.gender === 'female' ? "url(#grad-female)" : (d.data.gender === 'male' ? "url(#grad-male)" : '#9ca3af');
      })
      .style("stroke", colors.nodeStroke)
      .style("stroke-width", "2px")
      .classed("drop-shadow-md", true);

    // 3. Clip Path
    node.each(function(d: d3.HierarchyPointNode<FamilyMember>, i) {
        if (d.data.imageUrl) {
             defs.append("clipPath")
                .attr("id", "clip-circle-" + i)
                .append("circle")
                .attr("r", 26); // Match original radius
        }
    });

    // 4. Image
    node.filter((d: d3.HierarchyPointNode<FamilyMember>) => !!d.data.imageUrl && !heatmapMode)
        .append("image")
        .attr("class", "node-img")
        .attr("xlink:href", (d: d3.HierarchyPointNode<FamilyMember>) => d.data.imageUrl || '')
        .attr("x", -26)
        .attr("y", -26)
        .attr("width", 52)
        .attr("height", 52)
        .attr("clip-path", (d, i) => `url(#clip-circle-${i})`)
        .attr("preserveAspectRatio", "xMidYMid slice");

    // 5. Label Background
    node.append("rect")
      .attr("class", "node-label-rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("width", 110)
      .attr("height", 26)
      .attr("x", -55)
      .attr("y", orientation === 'horizontal' ? 32 : 32)
      .attr("fill", colors.bgLabel)
      .style("opacity", 0.9);

    // 6. Name
    node.append("text")
      .attr("class", "node-label-text")
      .attr("dy", orientation === 'horizontal' ? "49" : "49")
      .style("text-anchor", "middle")
      .text((d: d3.HierarchyPointNode<FamilyMember>) => d.data.name)
      .style("font-family", theme === 'vintage' ? 'Noto Naskh Arabic' : 'Vazirmatn')
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("fill", colors.text);

    // 7. Relation
    node.append("text")
      .attr("class", "node-label-sub")
      .attr("dy", orientation === 'horizontal' ? "64" : "64")
      .style("text-anchor", "middle")
      .text((d: d3.HierarchyPointNode<FamilyMember>) => d.data.relation || '')
      .style("font-family", theme === 'vintage' ? 'Noto Naskh Arabic' : 'Vazirmatn')
      .style("font-size", "10px")
      .style("fill", colors.textSecondary);
      
    // 8. Tags
    node.each(function(d: d3.HierarchyPointNode<FamilyMember>) {
        if (d.data.tags && d.data.tags.length > 0) {
            d3.select(this).selectAll(".tag-dot")
              .data(d.data.tags.slice(0, 3))
              .enter().append("circle")
              .attr("class", "tag-dot")
              .attr("r", 3)
              .attr("cx", (tag: Tag, i) => -15 + (i * 10))
              .attr("cy", -32)
              .attr("fill", (tag: Tag) => tag.color);
        }
    });

    // Keyboard Navigation Listener
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!selectedId) return;
        const current = nodeMapRef.current.get(selectedId);
        if (!current) return;
        
        let nextNode: d3.HierarchyPointNode<FamilyMember> | undefined;

        switch(e.key) {
            case 'ArrowLeft': // Go to Parent
                if(current.parent) nextNode = current.parent;
                break;
            case 'ArrowRight': // Go to First Child
                if(current.children && current.children.length > 0) nextNode = current.children[0];
                break;
            case 'ArrowUp': // Go to Prev Sibling
                if (current.parent && current.parent.children) {
                    const idx = current.parent.children.indexOf(current);
                    if (idx > 0) nextNode = current.parent.children[idx - 1];
                }
                break;
            case 'ArrowDown': // Go to Next Sibling
                 if (current.parent && current.parent.children) {
                    const idx = current.parent.children.indexOf(current);
                    if (idx < current.parent.children.length - 1) nextNode = current.parent.children[idx + 1];
                }
                break;
            case 'Enter':
                onOpenDetails(current.data);
                break;
        }

        if (nextNode && nextNode.data.relation !== 'SystemRoot') {
            e.preventDefault();
            onNodeClick(nextNode.data);
            
            // Auto Pan/Zoom to new node
            const t = zoomTransform;
            const targetX = orientation === 'horizontal' ? nextNode.y : nextNode.x;
            const targetY = orientation === 'horizontal' ? nextNode.x : nextNode.y;
            
            if (svgRef.current && zoomRef.current) {
                 d3.select(svgRef.current)
                   .transition()
                   .duration(300)
                   .call(zoomRef.current.translateTo, targetX + margin.left, targetY + margin.top);
            }
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);

  }, [data, dimensions, onNodeClick, onOpenDetails, selectedId, orientation, linkStyle, preventOverlap, theme, highlightedIds, heatmapMode]); // Removed zoomTransform

  // Handlers (handleZoom, handleFit, handleDownloadSVG)
  const handleZoom = (factor: number) => {
      if (svgRef.current && zoomRef.current) {
          d3.select(svgRef.current)
            .transition()
            .duration(300)
            .call(zoomRef.current.scaleBy, factor);
      }
  };

  const handleFit = () => {
      if (svgRef.current && zoomRef.current) {
           d3.select(svgRef.current)
            .transition()
            .duration(750)
            .call(zoomRef.current.transform, d3.zoomIdentity.translate(dimensions.width/2, 100).scale(1));
      }
  };

  const handleDownloadSVG = () => {
      if (!svgRef.current) return;
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nasab_tree_${theme}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const glassClass = theme === 'dark' ? 'glass-panel-dark' : (theme === 'vintage' ? 'glass-panel-vintage' : 'glass-panel');

  return (
    <div ref={wrapperRef} className="w-full h-full rounded-2xl overflow-hidden relative">
      
      {/* Quick Actions Floating Menu - Visible only when a node is selected */}
      {selectedId && selectedNodePos && onAddChild && onAddSibling && (
          <div 
            style={{ 
                position: 'absolute', 
                left: selectedNodePos.x + 50, 
                top: selectedNodePos.y - 30,
                zIndex: 100 // Higher index to float above SVG but below Modal
            }}
            className="flex flex-col gap-2 animate-in fade-in zoom-in duration-200"
          >
              <button onClick={() => onOpenDetails(nodeMapRef.current.get(selectedId)?.data as FamilyMember)} className="bg-slate-700 text-white p-2 rounded-full shadow-lg hover:bg-slate-900 hover:scale-110 transition-all border-2 border-white" title="مشاهده پروفایل کامل">
                  <User size={16}/>
              </button>
              <button onClick={() => onAddChild(selectedId)} className="bg-teal-500 text-white p-2 rounded-full shadow-lg hover:bg-teal-600 hover:scale-110 transition-all border-2 border-white" title="افزودن فرزند">
                  <Plus size={16}/>
              </button>
              <button onClick={() => onAddSibling(selectedId)} className="bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all border-2 border-white" title="افزودن هم‌سطح">
                  <GitBranch size={16}/>
              </button>
          </div>
      )}

      {/* Floating Toolbar */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
          
          {/* Visual Settings */}
          <div className={`${glassClass} shadow-lg rounded-xl p-1 flex flex-col gap-1 backdrop-blur-md`}>
             <button onClick={() => setLinkStyle(prev => prev === 'curved' ? 'straight' : 'curved')} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50'}`} title="تغییر نوع خطوط">
                  <GitMerge size={20} />
             </button>
             <button onClick={() => setPreventOverlap(!preventOverlap)} className={`p-2 rounded-lg transition-colors ${preventOverlap ? 'bg-indigo-100/50 text-indigo-600' : (theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50')}`} title="جلوگیری از تداخل خطوط">
                  <Route size={20} />
             </button>
             <button onClick={() => setHeatmapMode(!heatmapMode)} className={`p-2 rounded-lg transition-colors ${heatmapMode ? 'bg-orange-100/50 text-orange-600' : (theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50')}`} title="نقشه حرارتی نسل‌ها">
                  <div className="w-5 h-5 rounded bg-gradient-to-br from-slate-800 to-slate-300 border border-white/30"></div>
             </button>
          </div>

          {/* Zoom Controls */}
          <div className={`${glassClass} shadow-lg rounded-xl p-1 flex flex-col gap-1 backdrop-blur-md`}>
              <button onClick={() => handleZoom(1.2)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50'}`} title="بزرگنمایی">
                  <ZoomIn size={20} />
              </button>
              <button onClick={() => handleZoom(0.8)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50'}`} title="کوچک‌نمایی">
                  <ZoomOut size={20} />
              </button>
               <button onClick={handleFit} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50'}`} title="بازنشانی">
                  <Maximize size={20} />
              </button>
          </div>

          {/* Export */}
          <div className={`${glassClass} shadow-lg rounded-xl p-1 backdrop-blur-md`}>
               <button onClick={handleDownloadSVG} className={`p-2 rounded-lg ${theme === 'dark' ? 'text-teal-400 hover:bg-white/10' : 'text-teal-600 hover:bg-white/50'}`} title="دانلود تصویر">
                  <ImageIcon size={20} />
              </button>
          </div>
      </div>

      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>
    </div>
  );
};

export default FamilyTree;
