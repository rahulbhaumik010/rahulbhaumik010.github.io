const graphElement = document.getElementById("graph3d");
const infoPanel = document.getElementById("graphInfo");

fetch("data/researchGraph.json")
  .then(response => {
    if (!response.ok) {
      throw new Error("Could not load researchGraph.json");
    }
    return response.json();
  })
  .then(data => {
    const Graph = ForceGraph3D()(graphElement)
      .graphData(data)
      .backgroundColor("#000000")
      .showNavInfo(false)
      .nodeRelSize(5)
      .nodeVal(node => {
        if (node.type === "center") return 15;
        if (node.type === "theme") return 10;
        return 5;
      })
      .nodeColor(node => {
        if (node.type === "center") return "#ffffff";
        if (node.type === "theme") return "#9fd3ff";
        return "#d8e9ff";
      })
      .linkColor(() => "rgba(160, 205, 255, 0.34)")
      .linkOpacity(0.36)
      .linkWidth(link => link.strength ? link.strength * 0.75 : 0.8)
      .linkDirectionalParticles(1)
      .linkDirectionalParticleWidth(1.1)
      .nodeThreeObject(node => {
        const label = node.shortLabel || node.label;
        const sprite = new SpriteText(label);

        sprite.color =
          node.type === "center"
            ? "#ffffff"
            : node.type === "theme"
            ? "#9fd3ff"
            : "#eaf4ff";

        sprite.textHeight =
          node.type === "center"
            ? 10
            : node.type === "theme"
            ? 7
            : 4.6;

        sprite.backgroundColor =
          node.type === "paper"
            ? "rgba(8, 20, 38, 0.72)"
            : "rgba(0, 0, 0, 0.66)";

        sprite.padding = 4;
        sprite.borderRadius = 4;

        return sprite;
      })
      .onNodeClick(node => {
        showNodeDetails(node);

        const distance = 140;
        const length = Math.hypot(node.x || 0, node.y || 0, node.z || 0);
        const distRatio = 1 + distance / Math.max(length, 1);

        Graph.cameraPosition(
          {
            x: (node.x || 0) * distRatio,
            y: (node.y || 0) * distRatio,
            z: (node.z || 0) * distRatio
          },
          node,
          900
        );
      });

    Graph.cameraPosition({ x: 0, y: 0, z: 560 });

    Graph.d3Force("charge").strength(-140);

    Graph.d3Force("link").distance(link => {
      const sourceType = typeof link.source === "object" ? link.source.type : "";
      const targetType = typeof link.target === "object" ? link.target.type : "";

      if (sourceType === "center" || targetType === "center") return 120;
      if (sourceType === "theme" || targetType === "theme") return 88;
      return 68;
    });

    setTimeout(() => {
      Graph.zoomToFit(900, 120);
    }, 1200);

    window.addEventListener("resize", () => {
      Graph.width(window.innerWidth);
      Graph.height(window.innerHeight);
      setTimeout(() => Graph.zoomToFit(500, 120), 300);
    });

    function showNodeDetails(node) {
      const year = node.year ? `<p><strong>Year:</strong> ${node.year}</p>` : "";
      const venue = node.venue ? `<p><strong>Venue:</strong> ${node.venue}</p>` : "";
      const link = node.url
        ? `<a href="${node.url}" target="_blank" rel="noopener noreferrer">Open publication</a>`
        : "";

      infoPanel.innerHTML = `
        <h2>${node.label}</h2>
        <p><strong>Type:</strong> ${node.type || "node"}</p>
        ${year}
        ${venue}
        <p>${node.description || "No description added yet."}</p>
        ${link}
      `;
    }
  })
  .catch(error => {
    console.error("3D graph error:", error);

    infoPanel.innerHTML = `
      <h2>Graph could not be loaded</h2>
      <p>Please check graph3d.html, graph-3d.js, and data/researchGraph.json.</p>
      <p>${error.message}</p>
    `;
  });
