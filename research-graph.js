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

      const expandedThemes = new Set();

      function getVisibleData() {
        const visibleNodeIds = new Set();

        allNodes.forEach(n => {
          if (n.type === "center" || n.type === "theme") visibleNodeIds.add(n.id);
        });

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
          if (node.type === "theme")  return expandedThemes.has(node.id) ? "#b85c2a" : "#888";
          return "#2a5cb8";
        })
        .linkColor(() => "rgba(80,80,80,0.18)")
        .linkWidth(link => link.strength ? link.strength : 1)
        .enableNodeDrag(true)
        .enableZoomInteraction(true)
        .enablePanInteraction(true)

        .nodeCanvasObject((node, ctx, globalScale) => {
          const label     = node.shortLabel || node.label;
          const isCenter  = node.type === "center";
          const isTheme   = node.type === "theme";
          const isExpanded = isTheme && expandedThemes.has(node.id);

          const radius = isCenter ? 13 : isTheme ? 9 : 5.5;

          // Subtle pulsing ring on un-expanded theme nodes only
          if (isTheme && !isExpanded) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 800 + (node.index || 0) * 1.5);
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 4 + pulse * 3, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(120,120,120,${0.1 + pulse * 0.15})`;
            ctx.lineWidth = 1.2 / globalScale;
            ctx.stroke();
          }

          // Expanded theme: accent ring
          if (isExpanded) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(184,92,42,0.4)";
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
          }

          // Main circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = isCenter  ? "#1a1a1a"
                        : isExpanded ? "#b85c2a"
                        : isTheme   ? "#888888"
                        : "#2a5cb8";
          ctx.fill();

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

          ctx.fillStyle = isCenter  ? "rgba(26,26,26,0.85)"
                        : isExpanded ? "rgba(184,92,42,0.85)"
                        : isTheme   ? "rgba(100,100,100,0.82)"
                        : "rgba(42,92,184,0.82)";
          roundRect(ctx, node.x - bgW / 2, textY - bgH / 2, bgW, bgH, 4);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(label, node.x, textY);
        })

        .nodePointerAreaPaint((node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 22, 0, 2 * Math.PI, false);
          ctx.fill();
        })

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

      // ── Forces ─────────────────────────────────────────────
      Graph.d3Force("charge").strength(-220);

      Graph.d3Force("link").distance(link => {
        const s = typeof link.source === "object" ? link.source.type : "";
        const t = typeof link.target === "object" ? link.target.type : "";
        if (s === "center" || t === "center") return 130;
        if (s === "paper"  || t === "paper")  return 85;
        return 110;
      });

      // Collision detection — keeps nodes from overlapping
      Graph.d3Force("collision",
        d3 ? d3.forceCollide(node => {
          if (node.type === "center") return 28;
          if (node.type === "theme")  return 22;
          return 14;
        }).strength(0.85) : null
      );

      // ── Load initial data ───────────────────────────────────
      Graph.graphData(getVisibleData());

      setTimeout(() => Graph.zoomToFit(800, 80), 800);
      setTimeout(() => Graph.zoomToFit(800, 80), 1800);

      // Continuous re-render for pulse animation
      (function animateLoop() {
        requestAnimationFrame(animateLoop);
        Graph.nodeColor(node => {
          if (node.type === "center") return "#1a1a1a";
          if (node.type === "theme")  return expandedThemes.has(node.id) ? "#b85c2a" : "#888";
          return "#2a5cb8";
        });
      })();

      window.addEventListener("resize", () => {
        Graph.width(getWidth()).height(getHeight());
        setTimeout(() => Graph.zoomToFit(500, 80), 200);
      });

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

      infoPanel.innerHTML = `
        <p class="panel-label">Research Constellation</p>
        <h3>Explore themes</h3>
        <p>Click any <strong>theme node</strong> to expand its related publications. Click the <strong>center node</strong> to enter the immersive 3D view.</p>
      `;
    })
    .catch(error => {
      console.error("Research graph error:", error);
      graphContainer.innerHTML = `<div class="graph-error"><strong>Research graph could not be loaded.</strong></div>`;
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
