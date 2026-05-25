const graphContainer = document.getElementById("researchGraph");
const infoPanel = document.getElementById("researchInfoPanel");

if (graphContainer) {
  fetch("data/researchGraph.json")
    .then(response => {
      if (!response.ok) throw new Error("Could not load researchGraph.json");
      return response.json();
    })
    .then(data => {
      const allNodes = data.nodes;
      const allLinks = data.links;

      // ── State ──────────────────────────────────────────────
      // Track which theme nodes are "expanded" (showing their papers)
      const expandedThemes = new Set();

      // ── Compute visible graph data ─────────────────────────
      function getVisibleData() {
        const visibleNodeIds = new Set();

        // Always show center + theme nodes
        allNodes.forEach(n => {
          if (n.type === "center" || n.type === "theme") {
            visibleNodeIds.add(n.id);
          }
        });

        // Show paper nodes only for expanded themes
        allLinks.forEach(link => {
          const sourceId = typeof link.source === "object" ? link.source.id : link.source;
          const targetId = typeof link.target === "object" ? link.target.id : link.target;

          if (expandedThemes.has(sourceId) || expandedThemes.has(targetId)) {
            const paperNode = allNodes.find(n =>
              (n.id === targetId && n.type === "paper") ||
              (n.id === sourceId && n.type === "paper")
            );
            if (paperNode) visibleNodeIds.add(paperNode.id);
          }
        });

        const visibleNodes = allNodes.filter(n => visibleNodeIds.has(n.id));
        const visibleLinks = allLinks.filter(link => {
          const s = typeof link.source === "object" ? link.source.id : link.source;
          const t = typeof link.target === "object" ? link.target.id : link.target;
          return visibleNodeIds.has(s) && visibleNodeIds.has(t);
        });

        return { nodes: visibleNodes, links: visibleLinks };
      }

      // ── Graph setup ────────────────────────────────────────
      const getWidth  = () => graphContainer.clientWidth  || 900;
      const getHeight = () => graphContainer.clientHeight || 700;

      const Graph = ForceGraph()(graphContainer)
        .width(getWidth())
        .height(getHeight())
        .backgroundColor("#fbfaf7")
        .nodeId("id")
        .nodeVal(node => {
          if (node.type === "center") return 20;
          if (node.type === "theme")  return 13;
          return 7;
        })
        .nodeColor(node => {
          if (node.type === "center") return "#1a1a1a";
          if (node.type === "theme")  return expandedThemes.has(node.id) ? "#b85c2a" : "#2a5cb8";
          return "#6a9a6a";
        })
        .linkColor(() => "rgba(80,80,80,0.22)")
        .linkWidth(link => link.strength ? link.strength : 1)
        .enableNodeDrag(true)
        .enableZoomInteraction(true)
        .enablePanInteraction(true)

        // ── Custom node rendering ──────────────────────────
        .nodeCanvasObject((node, ctx, globalScale) => {
          const label    = node.shortLabel || node.label;
          const isCenter = node.type === "center";
          const isTheme  = node.type === "theme";
          const isPaper  = node.type === "paper";
          const isExpanded = isTheme && expandedThemes.has(node.id);

          const radius = isCenter ? 13 : isTheme ? 9 : 5.5;

          // Pulsing ring on theme nodes to invite interaction
          if (isTheme && !isExpanded) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 700 + node.index * 1.2);
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5 + pulse * 4, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(42,92,184,${0.12 + pulse * 0.18})`;
            ctx.lineWidth = 1.5 / globalScale;
            ctx.stroke();
          }

          // Expanded theme: outer ring
          if (isExpanded) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(184,92,42,0.35)";
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
          }

          // Main circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = isCenter ? "#1a1a1a"
                        : isExpanded ? "#b85c2a"
                        : isTheme ? "#2a5cb8"
                        : "#6a9a6a";
          ctx.fill();

          // White border
          ctx.lineWidth = 1.5 / globalScale;
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.stroke();

          // Label
          const fontSize = isCenter ? 13 : isTheme ? 11 : 9;
          ctx.font = `${isCenter || isTheme ? "600 " : ""}${fontSize}px neue-haas-grotesk-display, Helvetica Neue, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const textWidth = ctx.measureText(label).width;
          const bgH = fontSize + 8;
          const bgW = textWidth + 14;
          const textY = node.y + radius + 12;

          ctx.fillStyle = isCenter ? "rgba(26,26,26,0.82)"
                        : isExpanded ? "rgba(184,92,42,0.82)"
                        : isTheme ? "rgba(42,92,184,0.82)"
                        : "rgba(106,154,106,0.82)";
          roundRect(ctx, node.x - bgW / 2, textY - bgH / 2, bgW, bgH, 4);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(label, node.x, textY);

          // "Click to expand" hint on theme nodes
          if (isTheme && !isExpanded) {
            const hint = "click to expand";
            const hintSize = 7.5;
            ctx.font = `${hintSize}px Helvetica Neue, Arial, sans-serif`;
            const hintW = ctx.measureText(hint).width + 10;
            const hintY = textY + bgH / 2 + 10;
            ctx.fillStyle = "rgba(42,92,184,0.55)";
            roundRect(ctx, node.x - hintW / 2, hintY - hintSize / 2 - 2, hintW, hintSize + 6, 3);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.fillText(hint, node.x, hintY + 1);
          }

          if (isExpanded) {
            const hint = "click to collapse";
            const hintSize = 7.5;
            ctx.font = `${hintSize}px Helvetica Neue, Arial, sans-serif`;
            const hintW = ctx.measureText(hint).width + 10;
            const hintY = textY + bgH / 2 + 10;
            ctx.fillStyle = "rgba(184,92,42,0.55)";
            roundRect(ctx, node.x - hintW / 2, hintY - hintSize / 2 - 2, hintW, hintSize + 6, 3);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.fillText(hint, node.x, hintY + 1);
          }
        })

        .nodePointerAreaPaint((node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 22, 0, 2 * Math.PI, false);
          ctx.fill();
        })

        // ── Node click ────────────────────────────────────
        .onNodeClick(node => {
          if (node.type === "center") {
            window.location.href = "graph3d.html";
            return;
          }

          if (node.type === "theme") {
            if (expandedThemes.has(node.id)) {
              expandedThemes.delete(node.id);
            } else {
              expandedThemes.add(node.id);
            }
            // Refresh graph with new visible data
            Graph.graphData(getVisibleData());
            setTimeout(() => Graph.zoomToFit(600, 80), 400);
            showNodeDetails(node);
            return;
          }

          if (node.type === "paper") {
            showNodeDetails(node);
            Graph.centerAt(node.x, node.y, 700);
            Graph.zoom(2.0, 700);
          }
        });

      // ── Force config ───────────────────────────────────
      Graph.d3Force("charge").strength(-160);
      Graph.d3Force("link").distance(link => {
        const s = typeof link.source === "object" ? link.source.type : "";
        const t = typeof link.target === "object" ? link.target.type : "";
        if (s === "center" || t === "center") return 120;
        if (s === "paper"  || t === "paper")  return 80;
        return 100;
      });

      // ── Initial data (center + themes only) ────────────
      Graph.graphData(getVisibleData());

      setTimeout(() => Graph.zoomToFit(800, 80), 800);
      setTimeout(() => Graph.zoomToFit(800, 80), 1800);

      // ── Animate pulsing rings ──────────────────────────
      // Re-render continuously so the pulse animation plays
      (function animateLoop() {
        Graph.nodeColor(node => {
          if (node.type === "center") return "#1a1a1a";
          if (node.type === "theme")  return expandedThemes.has(node.id) ? "#b85c2a" : "#2a5cb8";
          return "#6a9a6a";
        });
        requestAnimationFrame(animateLoop);
      })();

      // ── Resize ─────────────────────────────────────────
      window.addEventListener("resize", () => {
        Graph.width(getWidth()).height(getHeight());
        setTimeout(() => Graph.zoomToFit(500, 80), 200);
      });

      // ── Info panel ─────────────────────────────────────
      function showNodeDetails(node) {
        const year  = node.year  ? `<p><strong>Year:</strong> ${node.year}</p>`   : "";
        const venue = node.venue ? `<p><strong>Venue:</strong> ${node.venue}</p>` : "";
        const type  = node.type  ? node.type.replace("-", " ") : "node";
        const link  = node.url
          ? `<a class="paper-link" href="${node.url}" target="_blank" rel="noopener noreferrer">Open publication</a>`
          : "";

        infoPanel.innerHTML = `
          <p class="panel-label">${type}</p>
          <h3>${node.label}</h3>
          ${year}${venue}
          <p>${node.description || "No description added yet."}</p>
          ${link}
        `;
      }

      // ── Default panel state ────────────────────────────
      infoPanel.innerHTML = `
        <p class="panel-label">Research Constellation</p>
        <h3>Explore themes</h3>
        <p>Click any <strong style="color:#2a5cb8">blue theme node</strong> to expand its related publications. Click the <strong>center node</strong> to enter the immersive 3D view.</p>
      `;
    })
    .catch(error => {
      console.error("Research graph error:", error);
      graphContainer.innerHTML = `
        <div class="graph-error">
          <strong>Research graph could not be loaded.</strong><br>
          Please check research-graph.js and data/researchGraph.json.
        </div>
      `;
    });
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
