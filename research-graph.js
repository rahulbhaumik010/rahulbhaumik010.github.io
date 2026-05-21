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
      const getWidth = () => graphContainer.clientWidth || 900;
      const getHeight = () => graphContainer.clientHeight || 700;

      const Graph = ForceGraph()(graphContainer)
        .graphData(data)
        .width(getWidth())
        .height(getHeight())
        .backgroundColor("#fbfaf7")
        .nodeId("id")
        .nodeVal(node => {
          if (node.type === "center") return 18;
          if (node.type === "theme") return 12;
          return 7;
        })
        .nodeColor(node => {
          if (node.type === "center") return "#2f2f2f";
          if (node.type === "theme") return "#9a6b3f";
          return "#355c7d";
        })
        .linkColor(() => "rgba(80, 80, 80, 0.28)")
        .linkWidth(link => link.strength ? link.strength : 1)
        .enableNodeDrag(true)
        .enableZoomInteraction(true)
        .enablePanInteraction(true)
        .nodeCanvasObject((node, ctx, globalScale) => {
          const label = node.shortLabel || node.label;
          const isCenter = node.type === "center";
          const isTheme = node.type === "theme";

          const radius = isCenter ? 11 : isTheme ? 8 : 5.5;

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = isCenter ? "#2f2f2f" : isTheme ? "#9a6b3f" : "#355c7d";
          ctx.fill();

          ctx.lineWidth = 1.5 / globalScale;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
          ctx.stroke();

          const fontSize = isCenter ? 14 : isTheme ? 12 : 10;
          ctx.font = `${fontSize}px Roboto, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const textWidth = ctx.measureText(label).width;
          const bgHeight = fontSize + 8;
          const bgWidth = textWidth + 14;
          const textX = node.x;
          const textY = node.y + radius + 12;

          ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
          roundRect(
            ctx,
            textX - bgWidth / 2,
            textY - bgHeight / 2,
            bgWidth,
            bgHeight,
            6
          );
          ctx.fill();

          ctx.fillStyle = isCenter ? "#2f2f2f" : isTheme ? "#6f4518" : "#243b53";
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
          Graph.centerAt(node.x, node.y, 700);
          Graph.zoom(1.7, 700);
        });

      Graph.d3Force("charge").strength(-120);
      Graph.d3Force("link").distance(link => {
        const sourceType = typeof link.source === "object" ? link.source.type : "";
        const targetType = typeof link.target === "object" ? link.target.type : "";

        if (sourceType === "center" || targetType === "center") return 110;
        if (sourceType === "paper" || targetType === "paper") return 85;
        return 95;
      });

      setTimeout(() => Graph.zoomToFit(800, 80), 800);
      setTimeout(() => Graph.zoomToFit(800, 80), 1800);

      window.addEventListener("resize", () => {
        Graph.width(getWidth());
        Graph.height(getHeight());
        setTimeout(() => Graph.zoomToFit(500, 80), 200);
      });

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
