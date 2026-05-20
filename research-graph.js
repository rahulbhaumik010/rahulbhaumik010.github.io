const graphContainer = document.getElementById("researchGraph");
const infoPanel = document.getElementById("researchInfoPanel");

fetch("data/researchGraph.json")
  .then(response => response.json())
  .then(data => {
    const Graph = ForceGraph3D()(graphContainer)
      .graphData(data)
      .backgroundColor("#f7f4ef")
      .nodeLabel(node => `${node.label}${node.year ? " (" + node.year + ")" : ""}`)
      .nodeRelSize(6)
      .linkOpacity(0.45)
      .linkWidth(1.2)
      .linkDirectionalParticles(1)
      .linkDirectionalParticleWidth(1.4)
      .nodeColor(node => {
        if (node.type === "center") return "#2f2f2f";
        if (node.type === "theme") return "#9a6b3f";
        if (node.type === "paper") return "#355c7d";
        return "#777";
      })
      .nodeVal(node => {
        if (node.type === "center") return 10;
        if (node.type === "theme") return 6;
        return 3.5;
      })
      .onNodeClick(node => {
        showNodeDetails(node);
      });

    Graph.cameraPosition({ z: 420 });

    function showNodeDetails(node) {
      const year = node.year ? `<p><strong>Year:</strong> ${node.year}</p>` : "";
      const venue = node.venue ? `<p><strong>Venue:</strong> ${node.venue}</p>` : "";
      const link = node.url
        ? `<a class="paper-link" href="${node.url}" target="_blank" rel="noopener noreferrer">Open publication</a>`
        : "";

      infoPanel.innerHTML = `
        <p class="panel-label">${node.type}</p>
        <h3>${node.label}</h3>
        ${year}
        ${venue}
        <p>${node.description || "No description added yet."}</p>
        ${link}
      `;
    }

    window.addEventListener("resize", () => {
      Graph.width(graphContainer.offsetWidth);
      Graph.height(graphContainer.offsetHeight);
    });
  })
  .catch(error => {
    console.error("Could not load research graph:", error);
    graphContainer.innerHTML = "<p>Research graph could not be loaded.</p>";
  });
