/* ─────────────────────────────────────────────────────────────
   Research Constellation — 2D force graph
   • Centre node = the "rb" mark from the site header
   • Clickable nodes look raised (soft shadow + light-from-top gradient)
     and emit faint, staggered ripples that fade into the background
   • Zoom is clamped relative to the initial "fit" view (50 % – 200 %)
───────────────────────────────────────────────────────────── */

const graphContainer = document.getElementById("researchGraph");
const infoPanel = document.getElementById("researchInfoPanel");

const INK = "#141414";
const ACCENT = "#f24e1e";
const ZOOM_MIN_FACTOR = 0.5;   // can shrink to 50 % of the fitted view
const ZOOM_MAX_FACTOR = 2.0;   // can enlarge to 200 % of the fitted view
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (graphContainer) {
  fetch("data/researchGraph.json")
    .then(response => {
      if (!response.ok) throw new Error("Could not load researchGraph.json");
      return response.json();
    })
    .then(data => {
      const allNodes = data.nodes;
      const allLinks = data.links;
      const expandedThemes = new Set();
      let hoverNode = null;
      let selectedNode = null;

      const themeCount = allNodes.filter(n => n.type === "theme").length;
      const paperCount = allNodes.filter(n => n.type === "paper").length;

      // Stable per-node phase so ripples are staggered, not synchronised
      allNodes.forEach((n, i) => { n.__phase = (i * 0.618) % 1; });

      function getVisibleData() {
        const visible = new Set();
        allNodes.forEach(n => { if (n.type === "center" || n.type === "theme") visible.add(n.id); });
        allLinks.forEach(link => {
          const s = typeof link.source === "object" ? link.source.id : link.source;
          const t = typeof link.target === "object" ? link.target.id : link.target;
          if (expandedThemes.has(s) || expandedThemes.has(t)) {
            const paper = allNodes.find(n => (n.id === t || n.id === s) && n.type === "paper");
            if (paper) visible.add(paper.id);
          }
        });
        return {
          nodes: allNodes.filter(n => visible.has(n.id)),
          links: allLinks.filter(link => {
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            return visible.has(s) && visible.has(t);
          })
        };
      }

      const radiusOf = n => n.type === "center" ? 24 : n.type === "theme" ? 10 : 6;

      const getWidth  = () => graphContainer.clientWidth  || 900;
      const getHeight = () => graphContainer.clientHeight || 600;

      const Graph = ForceGraph()(graphContainer)
        .width(getWidth())
        .height(getHeight())
        .backgroundColor("#ffffff")
        .autoPauseRedraw(false)          // keep ripples animating
        .nodeId("id")
        .nodeVal(n => radiusOf(n))
        .nodeLabel(n => n.type === "center" ? "Enter 3D view" : "")
        .linkColor(link => {
          const s = typeof link.source === "object" ? link.source : null;
          const t = typeof link.target === "object" ? link.target : null;
          const active = (s && (s === hoverNode || s === selectedNode)) || (t && (t === hoverNode || t === selectedNode));
          return active ? "rgba(242,78,30,0.55)" : "rgba(20,20,20,0.12)";
        })
        .linkWidth(link => (link.strength || 1) * 0.9)
        .enableNodeDrag(true)
        .enableZoomInteraction(true)
        .enablePanInteraction(true)
        .nodeCanvasObject(drawNode)
        .nodePointerAreaPaint((node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radiusOf(node) + 6, 0, 2 * Math.PI);
          ctx.fill();
        })
        .onNodeHover(node => {
          hoverNode = node || null;
          graphContainer.style.cursor = node ? "pointer" : "grab";
        })
        .onNodeClick(node => {
          if (node.type === "center") { window.location.href = "graph3d.html"; return; }
          selectedNode = node;
          if (node.type === "theme") {
            expandedThemes.has(node.id) ? expandedThemes.delete(node.id) : expandedThemes.add(node.id);
            Graph.graphData(getVisibleData());
            setTimeout(() => fit(600), 400);
          } else {
            Graph.centerAt(node.x, node.y, 600);
          }
          showNodeDetails(node);
        })
        .onBackgroundClick(() => { selectedNode = null; showOverview(); });

      /* ── Drawing ─────────────────────────────────────────── */
      function drawNode(node, ctx, scale) {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
        const isCenter = node.type === "center";
        const isTheme = node.type === "theme";
        const isExpanded = isTheme && expandedThemes.has(node.id);
        const isHover = node === hoverNode;
        const isSelected = node === selectedNode;
        const r = radiusOf(node) * (isHover ? 1.12 : 1);
        const t = Date.now() / 1000;

        // 1 · Ripples — faint rings that expand and fade out (clickable nodes that invite action)
        const rippleNode = true;  // every node is clickable; strength varies by type
        if (rippleNode && !REDUCED_MOTION) {
          const period = isCenter ? 3.2 : 2.8;
          const reach = isCenter ? 26 : isTheme ? 16 : 9;
          const strength = isHover ? 0.45 : isCenter ? 0.22 : isExpanded ? 0.1 : isTheme ? 0.18 : 0.12;
          const col = isExpanded || isHover && !isCenter ? "242,78,30" : "20,20,20";
          for (let k = 0; k < 2; k++) {
            const p = ((t / period) + node.__phase + k * 0.5) % 1;      // 0 → 1
            const ease = 1 - Math.pow(1 - p, 3);
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 2 + ease * reach, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(${col},${(strength * (1 - p)).toFixed(3)})`;
            ctx.lineWidth = (isCenter ? 1.4 : 1.1) / Math.max(scale, 0.6);
            ctx.stroke();
          }
        }

        // 2 · Raised body: soft drop shadow + top-lit gradient
        const base = isCenter ? INK : isExpanded ? ACCENT : isTheme ? "#a8a8a8" : INK;
        const light = isCenter ? "#3a3a3a" : isExpanded ? "#ff7a4d" : isTheme ? "#cfcfcf" : "#4a4a4a";
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.22)";
        ctx.shadowBlur = (isHover ? 14 : 8);
        ctx.shadowOffsetY = (isHover ? 4 : 2.5);
        const g = ctx.createRadialGradient(node.x - r * 0.35, node.y - r * 0.45, r * 0.1, node.x, node.y, r);
        g.addColorStop(0, light);
        g.addColorStop(1, base);
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();

        // Thin top highlight rim sells the "raised" feel
        ctx.beginPath();
        ctx.arc(node.x, node.y, r - 0.6, Math.PI * 1.1, Math.PI * 1.9);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1 / scale;
        ctx.stroke();

        // Selected: accent ring
        if (isSelected && !isCenter) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 3.5, 0, 2 * Math.PI);
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 1.6 / scale;
          ctx.stroke();
        }

        // 3 · Centre mark "rb"
        if (isCenter) {
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `800 ${r * 0.78}px 'Inter Tight', 'Helvetica Neue', Arial, sans-serif`;
          ctx.fillText("rb", node.x, node.y + 0.5);
          return;
        }

        // 4 · Labels (papers only when zoomed in, hovered or selected — keeps the map calm)
        const showLabel = isTheme || isHover || isSelected || scale > 1.6;
        if (!showLabel) return;
        const label = node.shortLabel || node.label;
        const fontSize = (isTheme ? 11 : 9.5) / Math.min(Math.max(scale, 0.8), 1.4);
        ctx.font = `${isTheme ? 600 : 500} ${fontSize}px 'Inter Tight', 'Helvetica Neue', Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const y = node.y + r + 5;
        ctx.lineJoin = "round";
        ctx.lineWidth = 4 / scale;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.strokeText(label, node.x, y);
        ctx.fillStyle = isExpanded || isSelected ? ACCENT : isTheme ? INK : "#555";
        ctx.fillText(label, node.x, y);
      }

      /* ── Forces ──────────────────────────────────────────── */
      Graph.d3Force("charge").strength(-240);
      Graph.d3Force("link").distance(link => {
        const s = typeof link.source === "object" ? link.source.type : "";
        const tt = typeof link.target === "object" ? link.target.type : "";
        if (s === "center" || tt === "center") return 135;
        if (s === "paper" || tt === "paper") return 85;
        return 110;
      });
      if (window.d3) {
        Graph.d3Force("collision", d3.forceCollide(n => radiusOf(n) + (n.type === "paper" ? 9 : 16)).strength(0.85));
      }

      /* ── Zoom limits ─────────────────────────────────────── */
      let fitMin = null, fitInitial = null;
      function applyZoomLimits() {
        const k = Graph.zoom();
        if (!fitInitial) fitInitial = k;
        // Lower bound follows the smallest fitted view, so fitting an expanded graph is never blocked
        fitMin = fitMin ? Math.min(fitMin, k) : k;
        Graph.minZoom(fitMin * ZOOM_MIN_FACTOR).maxZoom(fitInitial * ZOOM_MAX_FACTOR);
      }
      function fit(ms) {
        Graph.zoomToFit(ms, 60);
        setTimeout(applyZoomLimits, ms + 60);
      }

      Graph.graphData(getVisibleData());
      setTimeout(() => fit(700), 700);
      setTimeout(() => fit(700), 1700);

      window.addEventListener("resize", () => {
        Graph.width(getWidth()).height(getHeight());
        fitMin = fitInitial = null;
        setTimeout(() => fit(400), 200);
      });

      /* ── Side panel ──────────────────────────────────────── */
      function showNodeDetails(node) {
        const type = node.type === "theme" ? "Theme" : "Publication";
        const meta = [node.venue, node.year].filter(Boolean).join(" · ");
        let related = "";
        if (node.type === "theme") {
          const papers = allLinks
            .map(l => {
              const src = typeof l.source === "object" ? l.source : allNodes.find(n => n.id === l.source);
              const tgt = typeof l.target === "object" ? l.target : allNodes.find(n => n.id === l.target);
              if (src && src.id === node.id) return tgt;
              if (tgt && tgt.id === node.id) return src;
              return null;
            })
            .filter(n => n && n.type === "paper");
          const uniq = [...new Map(papers.map(p => [p.id, p])).values()];
          related = uniq.length
            ? `<p class="panel-count">${uniq.length} publication${uniq.length > 1 ? "s" : ""}</p>
               <ul class="panel-papers">${uniq
                 .sort((a, b) => (b.year || 0) - (a.year || 0))
                 .map(p => `<li><a href="${p.url}" target="_blank" rel="noopener noreferrer"><span>${p.year || ""}</span>${p.shortLabel || p.label}</a></li>`)
                 .join("")}</ul>`
            : "";
        }
        const link = node.url
          ? `<a class="paper-link" href="${node.url}" target="_blank" rel="noopener noreferrer">Open publication ↗</a>`
          : "";
        infoPanel.innerHTML = `
          <p class="panel-label">${type}</p>
          <h3>${node.label}</h3>
          ${meta ? `<p class="panel-meta">${meta}</p>` : ""}
          <p>${node.description || ""}</p>
          ${related}
          ${link}
        `;
      }

      function showOverview() {
        infoPanel.innerHTML = `
          <p class="panel-label">Research constellation</p>
          <h3>${themeCount} themes · ${paperCount} publications</h3>
          <ul class="legend">
            <li><span class="dot dot-center">rb</span>Rahul Bhaumik</li>
            <li><span class="dot dot-theme"></span>Research theme</li>
            <li><span class="dot dot-open"></span>Theme in view</li>
            <li><span class="dot dot-paper"></span>Publication</li>
          </ul>
        `;
      }
      showOverview();
    })
    .catch(error => {
      console.error("Research graph error:", error);
      graphContainer.innerHTML = `<div class="graph-error"><strong>Research graph could not be loaded.</strong></div>`;
    });
}
