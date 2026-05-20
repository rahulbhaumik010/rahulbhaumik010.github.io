const graphContainer = document.getElementById("researchGraph");
const infoPanel = document.getElementById("researchInfoPanel");

function getGraphSize() {
  const width = graphContainer.clientWidth || 800;
  const height = graphContainer.clientHeight || 560;
  return { width, height };
}

fetch("data/researchGraph.json")
  .then(response => response.json())
  .then(data => {
    const { width, height } = getGraphSize();

    const Graph = ForceGraph3D()(graphContainer)
      .graphData(data)
      .width(width)
      .height(height)
      .backgroundColor("#fbfaf7")
      .showNavInfo(false)
      .nodeRelSize(4)
      .linkOpacity(0.35)
      .linkWidth(link => link.strength || 1)
      .linkColor(() => "rgba(70, 70, 70, 0.45)")
      .linkDirectionalParticles(0)
      .d3VelocityDecay(0.42)
      .cooldownTicks(120)
      .nodeThreeObject(node => {
        const label = node.shortLabel || node.label;

        const sprite = new SpriteText(label);
        sprite.color = node.type === "center" ? "#1f2933" :
                       node.type === "theme" ? "#8a5a2b" :
                       "#284b63";

        sprite.textHeight = node.type === "center" ? 9 :
                            node.type === "theme" ? 7 :
                            5;

        sprite.backgroundColor = node.type === "paper"
          ? "rgba(255, 255, 255, 0.82)"
          : "rgba(255, 248, 238, 0.9)";

        sprite.borderColor = "rgba(0, 0, 0, 0.12)";
        sprite.borderWidth = 0.6;
        sprite.borderRadius = 4;
        sprite.padding = node.type === "paper" ? 4 : 5;

        return sprite;
      })
      .nodeThreeObjectExtend(false)
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

    Graph.cameraPosition({ x: 0, y: 0, z: 360 });

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

    window.addEventListener("resize", () => {
      const { width, height } = getGraphSize();
      Graph.width(width);
      Graph.height(height);
    });
  })
  .catch(error => {
    console.error("Could not load research graph:", error);
    graphContainer.innerHTML = "<p class='graph-error'>Research graph could not be loaded.</p>";
  });
