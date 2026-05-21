const graphContainer = document.getElementById("researchGraph");
const infoPanel = document.getElementById("researchInfoPanel");

if (graphContainer) {
  fetch("data/researchGraph.json")
    .then(response => {
      if (!response.ok) {
        throw new Error("Could not load researchGraph.json");
      }
      return response.json();
    })
    .then(data => {
      const paperCount = data.nodes.filter(n => n.type === "paper").length;
      const themeCount = data.nodes.filter(n => n.type === "theme").length;

      const graphHeader = document.createElement("div");
      graphHeader.className = "graph-toolbar";
      graphHeader.innerHTML = `
        <span>${paperCount} publications · ${themeCount} research themes</span>
        <button id="fitGraphButton" type="button">Show full map</button>
      `;
      graphContainer.parentNode.insertBefore(graphHeader, graphContainer);

      const getWidth = () => graphContainer.clientWidth || 900;
      const getHeight = () => graphContainer.clientHeight || 720;

      const Graph = ForceGraph()(graphContainer)
        .graphData(data)
        .width(getWidth())
        .height(getHeight())
        .backgroundColor("#fbfaf7")
        .nodeId("id")
        .nodeVal(node => {
          if (node.type === "center") return 14;
          if (node.type === "theme") return 9;
          return 5;
        })
        .nodeColor(node => {
          if (node.type === "center") return "#222222";
          if (node.type === "theme") return "#9a6b3f";
          return "#355c7d";
        })
        .linkColor(() => "rgba(70, 70, 70, 0.24)")
        .linkWidth(link => link.strength ? link.strength * 0.75 : 0.8)
        .enableNodeDrag(true)
        .enableZoomInteraction(true)
        .enablePanInteraction(true)
        .cooldownTicks(180)
        .nodeCanvasObject((node, ctx, globalScale) => {
          const label = node.shortLabel || node.label;
          const isCenter = node.type === "center";
          const isTheme = node.type === "theme";
          const isPaper = node.type === "paper";

          const radius = isCenter ? 9 : isTheme ? 7 : 4.5;

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = isCenter ? "#222222" : isTheme ? "#9a6b3f" : "#355c7d";
          ctx.fill();

          ctx.lineWidth = 1.2 / globalScale;
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.stroke();

          const fontSize = isCenter ? 13 : isTheme ? 11 : 8.5;
          ctx.font = `${fontSize}px Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const textWidth = ctx.measureText(label).width;
          const bgWidth = textWidth + 10;
          const bgHeight = fontSize + 7;

          const textX = node.x;
          const textY = node.y + radius + 11;

          ctx.fillStyle = isPaper
            ? "rgba(255,255,255,0.78)"
            : "rgba(255,248,238,0.88)";

          roundRect(
            ctx,
            textX - bgWidth / 2,
            textY - bgHeight / 2,
            bgWidth,
            bgHeight,
            5
          );
          ctx.fill();

          ctx.fillStyle = isCenter ? "#222222" : isTheme ? "#6f4518" : "#243b53";
          ctx.fillText(label, textX, textY);
        })
        .nodePointerAreaPaint((node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 18, 0, 2 * Math.PI, false);
          ctx.fill();
        })
        .onNodeClick(node => {
          showNodeDetails(node);
          Graph.centerAt(node.x, node.y, 600);
          Graph.zoom(1.8, 600);
        })
        .onBackgroundClick(() => {
          fitFullGraph();
        })
        .onEngineStop(() => {
          fitFullGraph();
        });

      Graph.d3Force("charge").strength(-75);

      Graph.d3Force("link").distance(link => {
        const sourceType = typeof link.source === "object" ? link.source.type : "";
        const targetType = typeof link.target === "object" ? link.target.type : "";

        if (sourceType === "center" || targetType === "center") return 95;
        if (sourceType === "theme" || targetType === "theme") return 70;
        return 55;
      });

      Graph.d3Force("center").strength(0.12);

      setTimeout(fitFullGraph, 500);
      setTimeout(fitFullGraph, 1500);
      setTimeout(fitFullGraph, 3000);

      document.getElementById("fitGraphButton").addEventListener("click", fitFullGraph);

      window.addEventListener("resize", () => {
        Graph.width(getWidth());
        Graph.height(getHeight());
        setTimeout(fitFullGraph, 300);
      });

      function fitFullGraph() {
        Graph.zoomToFit(700, 90);
      }

      function showNodeDetails(node) {
        const year = node.year ? `<p><strong>Year:</strong> ${node.year}</p>` : "";
        const venue = node.venue ? `<p><strong>Venue:</strong> ${node.venue}</p>` : "";
        const type = node.type ? node.type.replace("-", " ") : "node";

        const link = node.url
          ? `<a class="paper-link" href="${node.url}" target="_blank" rel="noopener noreferrer">Open publication</a>`
          : "";

        infoPanel.innerHTML = `
          <p class="panel-label">${type}</p>
          <h3>${node.label}</h3>
          ${year}
          ${venue}
          <p>${node.description || "No description added yet."}</p>
          ${link}
        `;
      }
    })
    .catch(error => {
      console.error("Research graph error:", error);
      graphContainer.innerHTML = `
        <div class="graph-error">
          <strong>Research graph could not be loaded.</strong><br>
          Open the browser console and check the JavaScript error.
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
