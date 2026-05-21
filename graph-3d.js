const graphElement = document.getElementById("graph3d");
const infoPanel = document.getElementById("graphInfo");

fetch("data/researchGraph.json")
  .then(response => response.json())
  .then(data => {
    const Graph = ForceGraph3D()(graphElement)
      .graphData(data)
      .backgroundColor("#000000")
      .showNavInfo(false)
      .nodeRelSize(5)
      .nodeVal(node => {
        if (node.type === "center") return 14;
        if (node.type === "theme") return 9;
        return 5;
      })
      .nodeColor(node => {
        if (node.type === "center") return "#ffffff";
        if (node.type === "theme") return "#f4a261";
        return "#61a5c2";
      })
      .linkColor(() => "rgba(255,255,255,0.28)")
      .linkOpacity(0.32)
      .linkWidth(link => link.strength ? link.strength * 0.7 : 0.8)
      .linkDirectionalParticles(1)
      .linkDirectionalParticleWidth(1)
      .nodeThreeObject(node => {
        const label = node.shortLabel || node.label;
        const sprite = new SpriteText(label);

        sprite.color = node.type === "center"
          ? "#ffffff"
          : node.type === "theme"
          ? "#f4a261"
          : "#dbeafe";

        sprite.textHeight = node.type === "center"
          ? 10
          : node.type === "theme"
          ? 7
          : 4.8;

        sprite.backgroundColor = node.type === "paper"
          ? "rgba(20, 30, 45, 0.72)"
          : "rgba(0, 0, 0, 0.65)";

        sprite.padding = 4;
        sprite.borderRadius = 4;

        return sprite;
      })
      .onNodeClick(node => {
        showNodeDetails(node);

        const distance = 130;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        Graph.cameraPosition(
          {
            x: node.x * distRatio,
            y: node.y * distRatio,
            z: node.z * distRatio
          },
          node,
          900
        );
      });

    Graph.cameraPosition({ x: 0, y: 0, z: 520 });

    Graph.d3Force("charge").strength(-130);

    Graph.d3Force("link").distance(link => {
      const sourceType = typeof link.source === "object" ? link.source.type : "";
      const targetType = typeof link.target === "object" ? link.target.type : "";

      if (sourceType === "center" || targetType === "center") return 110;
      if (sourceType === "theme" || targetType === "theme") return 80;
      return 65;
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
      <p>Please check graph-3d.js and data/researchGraph.json.</p>
    `;
  });
