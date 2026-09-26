/* ─────────────────────────────────────────────────────────────
   Research Constellation — 2D map
   • Centre = the "rb" mark from the site header
   • Themes sit on a fixed ring, ordered so semantically related themes are neighbours
   • Clicking a theme makes its publications pop OUTWARD onto an outer orbit, fanned
     around that theme; links still connect each publication to every theme it belongs to
   • Nodes look raised and emit faint ripples (they invite a click without any instructions)
   • Details panel only exists once something is clicked
   • Zoom is clamped (50 % – 200 % of the fitted view)
───────────────────────────────────────────────────────────── */

const graphContainer = document.getElementById("researchGraph");
const infoPanel = document.getElementById("researchInfoPanel");

const INK = "#141414";
const ACCENT = "#f24e1e";
const FONT = "'Inter Tight', 'Helvetica Neue', Arial, sans-serif";
const RING_R = 200;                 // theme ring
const ORBIT_R = 300;                // publication orbit
const MIN_GAP = 0.075;              // min angle between neighbouring publications (radians)
const ZOOM_MIN_FACTOR = 0.5;
const ZOOM_MAX_FACTOR = 2.0;
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (graphContainer) {
  fetch("data/researchGraph.json")
    .then(r => { if (!r.ok) throw new Error("Could not load researchGraph.json"); return r.json(); })
    .then(data => {
      const allNodes = data.nodes;
      const allLinks = data.links;
      const byId = Object.fromEntries(allNodes.map(n => [n.id, n]));
      const idOf = end => (typeof end === "object" ? end.id : end);

      const expandOrder = [];       // themes in the order they were opened
      let hoverNode = null;
      let selectedNode = null;

      allNodes.forEach((n, i) => { n.__phase = (i * 0.618) % 1; });

      /* ── Theme ↔ publication index ───────────────────────── */
      const themes = allNodes.filter(n => n.type === "theme");
      const papersOf = {};
      themes.forEach(t => { papersOf[t.id] = new Set(); });
      allLinks.forEach(l => {
        const s = idOf(l.source), t = idOf(l.target);
        if (papersOf[s] && byId[t] && byId[t].type === "paper") papersOf[s].add(t);
        if (papersOf[t] && byId[s] && byId[s].type === "paper") papersOf[t].add(s);
      });

      /* ── Semantic ring order ─────────────────────────────────
         similarity = shared publications (cosine, 75 %) + shared description words (25 %);
         the best circular order is solved exactly (Held–Karp, fine for ≤ 16 themes). */
      const STOP = new Set("and the of for in a to with on design systems system interaction interactive".split(" "));
      const words = Object.fromEntries(themes.map(t => [t.id, new Set(
        ((t.label || "") + " " + (t.description || "")).toLowerCase().match(/[a-z]+/g)
          .filter(w => w.length > 2 && !STOP.has(w)))]));
      const cos = (A, B) => {
        if (!A.size || !B.size) return 0;
        let i = 0; A.forEach(x => { if (B.has(x)) i++; });
        return i / Math.sqrt(A.size * B.size);
      };
      const sim = (a, b) => 0.75 * cos(papersOf[a.id], papersOf[b.id]) + 0.25 * cos(words[a.id], words[b.id]);

      function circularOrder(items) {
        const n = items.length;
        if (n < 4 || n > 16) return items;
        const S = items.map(a => items.map(b => sim(a, b)));
        const size = 1 << n;
        const dp = new Float64Array(size * n).fill(-Infinity);
        const par = new Int8Array(size * n).fill(-1);
        dp[n] = 0; // mask=1, j=0
        for (let mask = 1; mask < size; mask += 2) {
          for (let j = 0; j < n; j++) {
            const v = dp[mask * n + j];
            if (v === -Infinity) continue;
            for (let k = 1; k < n; k++) {
              if (mask & (1 << k)) continue;
              const nm = mask | (1 << k), nv = v + S[j][k];
              if (nv > dp[nm * n + k]) { dp[nm * n + k] = nv; par[nm * n + k] = j; }
            }
          }
        }
        const full = size - 1;
        let best = 1, bestV = -Infinity;
        for (let j = 1; j < n; j++) {
          const v = dp[full * n + j] + S[j][0];
          if (v > bestV) { bestV = v; best = j; }
        }
        const order = [];
        let mask = full, j = best;
        while (j > 0) { order.push(j); const pj = par[mask * n + j]; mask ^= (1 << j); j = pj; }
        order.push(0);
        return order.reverse().map(i => items[i]);
      }

      const pin = (n, x, y) => { n.x = n.fx = x; n.y = n.fy = y; };
      const center = allNodes.find(n => n.type === "center");
      if (center) pin(center, 0, 0);
      circularOrder(themes).forEach((t, i, arr) => {
        t.__angle = -Math.PI / 2 + (i / arr.length) * 2 * Math.PI;   // start at 12 o'clock
        pin(t, RING_R * Math.cos(t.__angle), RING_R * Math.sin(t.__angle));
      });

      /* ── Publication layout: fan outward around the theme that opened them ── */
      function visiblePapers() {
        // paper id → theme it fans out from = the MOST RECENTLY opened theme it belongs to,
        // so clicking a theme always makes its publications spring out right next to it
        const owner = new Map();
        [...expandOrder].reverse().forEach(tid => {
          [...papersOf[tid]]
            .sort((a, b) => (byId[b].year || 0) - (byId[a].year || 0))
            .forEach(pid => { if (!owner.has(pid)) owner.set(pid, tid); });
        });
        return owner;
      }

      function layoutPapers(owner) {
        // ideal angle = owner's angle; keep each owner's papers together, then spread
        const groups = {};
        owner.forEach((tid, pid) => { (groups[tid] = groups[tid] || []).push(pid); });
        const items = [];
        Object.entries(groups).forEach(([tid, pids]) => {
          const a0 = byId[tid].__angle;
          pids.forEach((pid, i) => items.push({ pid, a: a0 + (i - (pids.length - 1) / 2) * MIN_GAP }));
        });
        // unwrap to a continuous range starting at 12 o'clock, then sort
        items.forEach(it => { while (it.a < -Math.PI / 2) it.a += 2 * Math.PI; while (it.a >= 1.5 * Math.PI) it.a -= 2 * Math.PI; });
        items.sort((p, q) => p.a - q.a);
        // relax so neighbours are at least MIN_GAP apart
        for (let iter = 0; iter < 200; iter++) {
          let moved = false;
          for (let i = 1; i < items.length; i++) {
            const d = items[i].a - items[i - 1].a;
            if (d < MIN_GAP) { const push = (MIN_GAP - d) / 2; items[i - 1].a -= push; items[i].a += push; moved = true; }
          }
          if (!moved) break;
        }
        const targets = new Map();
        items.forEach((it, i) => {
          const r = ORBIT_R;
          targets.set(it.pid, { x: r * Math.cos(it.a), y: r * Math.sin(it.a) });
        });
        return targets;
      }

      // Smooth "pop out" animation: papers travel from their theme to their orbit slot
      let tween = null;
      function animateTo(targets, owner) {
        const start = performance.now(), dur = REDUCED_MOTION ? 1 : 650;
        const from = new Map();
        targets.forEach((_, pid) => {
          const p = byId[pid];
          if (!Number.isFinite(p.x) || !p.__shown) { const t = byId[owner.get(pid)]; pin(p, t.x, t.y); }
          p.__shown = true;
          from.set(pid, { x: p.x, y: p.y });
        });
        const easeOutBack = t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
        const step = now => {
          const k = Math.min(1, (now - start) / dur), e = easeOutBack(k);
          targets.forEach((to, pid) => {
            const f = from.get(pid);
            pin(byId[pid], f.x + (to.x - f.x) * e, f.y + (to.y - f.y) * e);
          });
          if (k < 1) tween = requestAnimationFrame(step);
        };
        cancelAnimationFrame(tween);
        tween = requestAnimationFrame(step);
      }

      let currentOwner = new Map();
      function refresh() {
        const owner = visiblePapers();
        currentOwner = owner;
        allNodes.forEach(n => { if (n.type === "paper" && !owner.has(n.id)) n.__shown = false; });
        const targets = layoutPapers(owner);
        const ids = new Set(allNodes.filter(n => n.type !== "paper").map(n => n.id).concat([...owner.keys()]));
        animateTo(targets, owner);
        Graph.graphData({
          nodes: allNodes.filter(n => ids.has(n.id)),
          links: allLinks.filter(l => ids.has(idOf(l.source)) && ids.has(idOf(l.target)))
        });
        fit(650, targets);
      }

      /* ── Reset: double-click on empty space collapses everything ── */
      function resetGraph() {
        if (!expandOrder.length && !selectedNode) return;
        const shown = Graph.graphData().nodes.filter(n => n.type === "paper");
        const owner = currentOwner;
        expandOrder.length = 0;
        selectedNode = null;
        closePanel();
        // Papers fold back into their theme, then disappear
        const start = performance.now(), dur = REDUCED_MOTION ? 1 : 380;
        const from = new Map(shown.map(p => [p.id, { x: p.x, y: p.y }]));
        cancelAnimationFrame(tween);
        const step = now => {
          const k = Math.min(1, (now - start) / dur), e = k * k;
          shown.forEach(p => {
            const t = byId[owner.get(p.id)] || center, f = from.get(p.id);
            pin(p, f.x + (t.x - f.x) * e, f.y + (t.y - f.y) * e);
          });
          if (k < 1) tween = requestAnimationFrame(step);
          else refresh();
        };
        tween = requestAnimationFrame(step);
      }

      /* ── Graph ───────────────────────────────────────────── */
      const radiusOf = n => n.type === "center" ? 24 : n.type === "theme" ? 10 : 6;
      const getWidth = () => graphContainer.clientWidth || 900;
      const getHeight = () => graphContainer.clientHeight || 600;

      const Graph = ForceGraph()(graphContainer)
        .width(getWidth())
        .height(getHeight())
        .backgroundColor("#ffffff")
        .autoPauseRedraw(false)
        .nodeId("id")
        .nodeVal(n => radiusOf(n))
        .nodeLabel(n => n.type === "center" ? "Enter 3D view" : "")
        .linkColor(link => {
          const s = link.source, t = link.target;
          const active = [s, t].some(n => n && (n === hoverNode || n === selectedNode));
          if (active) return "rgba(242,78,30,0.6)";
          const paper = [s, t].find(n => n && n.type === "paper");
          if (!paper) return "rgba(20,20,20,0.11)";                       // centre ↔ theme spokes
          const theme = paper === s ? t : s;
          // Link to the theme it fans out from reads clearly; cross-links to other themes stay a whisper
          return currentOwner.get(paper.id) === theme.id ? "rgba(20,20,20,0.28)" : "rgba(20,20,20,0.05)";
        })
        .linkWidth(link => {
          const paper = [link.source, link.target].find(n => n && n.type === "paper");
          if (!paper) return 0.9;
          const theme = paper === link.source ? link.target : link.source;
          return currentOwner.get(paper.id) === theme.id ? 1 : 0.7;
        })
        .enableNodeDrag(false)
        .d3AlphaDecay(1)                 // layout is fully positional — no physics drift
        .nodeCanvasObject(drawNode)
        .nodePointerAreaPaint((node, color, ctx, scale) => {
          // Hit area = the dot AND its text label, so clicking/hovering a label works too
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radiusOf(node) + 6, 0, 2 * Math.PI);
          ctx.fill();
          if (node.type === "center" || !Number.isFinite(node.x)) return;
          const r = radiusOf(node);
          const ang = Math.atan2(node.y, node.x), c = Math.cos(ang), s = Math.sin(ang);
          if (node.type === "paper") {
            const w = labelWidth(node) / scale, h = 16 / scale;
            const flip = c < 0, off = r + 6 / scale;
            ctx.save();
            ctx.translate(node.x, node.y);
            ctx.rotate(flip ? ang + Math.PI : ang);
            ctx.fillRect(flip ? -off - w : off - 2 / scale, -h / 2, w + 4 / scale, h);
            ctx.restore();
          } else {
            const w = labelWidth(node) / scale + 6 / scale, h = 18 / scale;
            const off = r + 8 / scale, lx = node.x - c * off, ly = node.y - s * off;
            const alignX = -c > 0.6 ? 0 : -c < -0.6 ? -w : -w / 2;               // left / right / centre
            const alignY = Math.abs(c) > 0.6 ? -h / 2 : -s > 0 ? 0 : -h;         // middle / top / bottom
            ctx.fillRect(lx + alignX, ly + alignY, w, h);
          }
        })
        .onNodeHover(node => {
          hoverNode = node || null;
          graphContainer.style.cursor = node ? "pointer" : "grab";
        })
        .onNodeClick(node => {
          if (node.type === "center") { window.location.href = "graph3d.html"; return; }
          selectedNode = node;
          showNodeDetails(node);
          openPanel();
          if (node.type === "theme") {
            const i = expandOrder.indexOf(node.id);
            i >= 0 ? expandOrder.splice(i, 1) : expandOrder.push(node.id);
            refresh();
          }
        })
        .onBackgroundClick(() => { selectedNode = null; closePanel(); });

      // Positions are fully controlled (pinned); keep the link force only to resolve ids → nodes
      Graph.d3Force("charge", null);
      Graph.d3Force("center", null);
      Graph.d3Force("link").strength(0);

      // Capture phase: runs before the canvas's own double-click-to-zoom, which we suppress
      graphContainer.addEventListener("dblclick", e => {
        e.preventDefault();
        e.stopPropagation();
        // Only on empty space: hit-test the double-click position against the visible nodes
        const rect = graphContainer.getBoundingClientRect();
        const p = Graph.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top);
        const k = Graph.zoom();
        const onNode = Graph.graphData().nodes.some(n =>
          Math.hypot(n.x - p.x, n.y - p.y) < radiusOf(n) + 10 / k);
        if (!onNode) resetGraph();
      }, true);

      /* ── Drawing ─────────────────────────────────────────── */
      function drawNode(node, ctx, scale) {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
        const isCenter = node.type === "center";
        const isTheme = node.type === "theme";
        const isExpanded = isTheme && expandOrder.includes(node.id);
        const isHover = node === hoverNode;
        const isSelected = node === selectedNode;
        const r = radiusOf(node) * (isHover ? 1.12 : 1);
        const t = Date.now() / 1000;

        // Ripples — faint rings that expand and fade into the background
        if (!REDUCED_MOTION) {
          const period = isCenter ? 3.2 : 2.8;
          const reach = isCenter ? 26 : isTheme ? 16 : 9;
          const strength = isHover ? 0.45 : isCenter ? 0.22 : isExpanded ? 0.1 : isTheme ? 0.18 : 0.12;
          const col = isExpanded || (isHover && !isCenter) ? "242,78,30" : "20,20,20";
          for (let k = 0; k < 2; k++) {
            const p = ((t / period) + node.__phase + k * 0.5) % 1;
            const ease = 1 - Math.pow(1 - p, 3);
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 2 + ease * reach, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(${col},${(strength * (1 - p)).toFixed(3)})`;
            ctx.lineWidth = (isCenter ? 1.4 : 1.1) / Math.max(scale, 0.6);
            ctx.stroke();
          }
        }

        // Raised body: soft drop shadow + top-lit gradient
        const base = isCenter ? INK : isExpanded ? ACCENT : isTheme ? "#a8a8a8" : INK;
        const light = isCenter ? "#3a3a3a" : isExpanded ? "#ff7a4d" : isTheme ? "#cfcfcf" : "#4a4a4a";
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.22)";
        ctx.shadowBlur = isHover ? 14 : 8;
        ctx.shadowOffsetY = isHover ? 4 : 2.5;
        const g = ctx.createRadialGradient(node.x - r * 0.35, node.y - r * 0.45, r * 0.1, node.x, node.y, r);
        g.addColorStop(0, light);
        g.addColorStop(1, base);
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(node.x, node.y, r - 0.6, Math.PI * 1.1, Math.PI * 1.9);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1 / scale;
        ctx.stroke();

        if (isSelected && !isCenter) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 3.5, 0, 2 * Math.PI);
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 1.6 / scale;
          ctx.stroke();
        }

        if (isCenter) {
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `800 ${r * 0.78}px ${FONT}`;
          ctx.fillText("rb", node.x, node.y + 0.5);
          return;
        }

        // Labels: themes read INWARD (towards the centre, horizontal);
        // publications read OUTWARD along their ray (sunburst style) so they never collide.
        const label = node.shortLabel || node.label;
        const ang = Math.atan2(node.y, node.x), c = Math.cos(ang), s = Math.sin(ang);
        ctx.lineJoin = "round";
        ctx.lineWidth = 4 / scale;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.fillStyle = isExpanded || isSelected ? ACCENT : isTheme ? INK : "#4d4d4d";
        if (isTheme) {
          ctx.font = `600 ${12 / scale}px ${FONT}`;
          const off = r + 8 / scale;
          const lx = node.x - c * off, ly = node.y - s * off;
          ctx.textAlign = -c > 0.6 ? "left" : -c < -0.6 ? "right" : "center";
          ctx.textBaseline = Math.abs(c) > 0.6 ? "middle" : -s > 0 ? "top" : "bottom";
          ctx.strokeText(label, lx, ly);
          ctx.fillText(label, lx, ly);
        } else {
          ctx.font = `${isSelected || isHover ? 600 : 500} ${10.5 / scale}px ${FONT}`;
          const flip = c < 0;                                    // keep text upright on the left half
          ctx.save();
          ctx.translate(node.x, node.y);
          ctx.rotate(flip ? ang + Math.PI : ang);
          ctx.textAlign = flip ? "right" : "left";
          ctx.textBaseline = "middle";
          const off = (r + 6 / scale) * (flip ? -1 : 1);
          ctx.strokeText(label, off, 0);
          ctx.fillText(label, off, 0);
          ctx.restore();
        }
      }

      /* ── Fit + zoom limits ───────────────────────────────── */
      let fitMin = null, fitInitial = null;
      const measure = document.createElement("canvas").getContext("2d");
      function labelWidth(n) {              // on-screen px (labels are drawn at constant screen size)
        measure.font = `${n.type === "theme" ? 600 : 500} ${n.type === "theme" ? 12 : 10.5}px ${FONT}`;
        return measure.measureText(n.shortLabel || n.label).width;
      }
      function fit(ms, targets) {
        const nodes = Graph.graphData().nodes;
        if (!nodes.length) return;
        const pos = n => (targets && targets.get(n.id)) || { x: n.fx ?? n.x, y: n.fy ?? n.y };
        const W = getWidth(), H = getHeight(), pad = 18;
        // Iterate: bounds depend on k because labels have a fixed on-screen length
        let k = 1, box;
        for (let it = 0; it < 4; it++) {
          box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
          nodes.forEach(n => {
            const p = pos(n);
            const ext = [[p.x, p.y]];
            if (n.type === "paper") {
              const a = Math.atan2(p.y, p.x), L = (labelWidth(n) + 10) / k;
              ext.push([p.x + Math.cos(a) * L, p.y + Math.sin(a) * L]);
            } else {
              const half = (n.type === "center" ? 30 : 16) / k;
              ext.push([p.x - half, p.y - half], [p.x + half, p.y + half]);
            }
            ext.forEach(([x, y]) => {
              box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
              box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
            });
          });
          k = Math.min((W - 2 * pad) / Math.max(1, box.x1 - box.x0), (H - 2 * pad) / Math.max(1, box.y1 - box.y0));
        }
        k = Math.max(0.15, Math.min(k, 2.2));
        if (!fitInitial) fitInitial = k;
        fitMin = fitMin ? Math.min(fitMin, k) : k;
        Graph.minZoom(fitMin * ZOOM_MIN_FACTOR).maxZoom(Math.max(fitInitial, k) * ZOOM_MAX_FACTOR);
        Graph.centerAt((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, ms);
        Graph.zoom(k, ms);
      }

      /* ── Panel (not in the layout until something is clicked) ── */
      const layoutEl = graphContainer.closest(".graph-layout");
      const isOpen = () => layoutEl && layoutEl.classList.contains("panel-open");
      function openPanel() { if (layoutEl && !isOpen()) layoutEl.classList.add("panel-open"); }
      function closePanel() { if (layoutEl && isOpen()) layoutEl.classList.remove("panel-open"); }
      infoPanel.addEventListener("click", e => {
        if (e.target.closest(".panel-close")) { selectedNode = null; closePanel(); }
      });
      // Canvas follows its box whenever the panel appears/disappears or the window resizes
      let lastW = 0;
      const onResize = () => {
        const w = getWidth();
        Graph.width(w).height(getHeight());
        if (Math.abs(w - lastW) > 2) { lastW = w; fit(350); }
      };
      if (window.ResizeObserver) new ResizeObserver(onResize).observe(graphContainer);
      else window.addEventListener("resize", onResize);

      function showNodeDetails(node) {
        const type = node.type === "theme" ? "Theme" : "Publication";
        const meta = [node.venue, node.year].filter(Boolean).join(" · ");
        let related = "";
        if (node.type === "theme") {
          const list = [...papersOf[node.id]].map(id => byId[id]).sort((a, b) => (b.year || 0) - (a.year || 0));
          related = list.length ? `
            <p class="panel-count">${list.length} publication${list.length > 1 ? "s" : ""}</p>
            <ul class="panel-papers">${list.map(p =>
              `<li><a href="${p.url}" target="_blank" rel="noopener noreferrer"><span>${p.year || ""}</span>${p.shortLabel || p.label}</a></li>`).join("")}</ul>` : "";
        } else {
          const inThemes = themes.filter(t => papersOf[t.id].has(node.id)).map(t => t.shortLabel || t.label);
          related = inThemes.length ? `<p class="panel-count">${inThemes.join(" · ")}</p>` : "";
        }
        const link = node.url ? `<a class="paper-link" href="${node.url}" target="_blank" rel="noopener noreferrer">Open publication ↗</a>` : "";
        infoPanel.innerHTML = `
          <button class="panel-close" type="button" aria-label="Close details">×</button>
          <p class="panel-label">${type}</p>
          <h3>${node.label}</h3>
          ${meta ? `<p class="panel-meta">${meta}</p>` : ""}
          <p>${node.description || ""}</p>
          ${related}
          ${link}`;
      }

      Graph.graphData({
        nodes: allNodes.filter(n => n.type !== "paper"),
        links: allLinks.filter(l => byId[idOf(l.source)].type !== "paper" && byId[idOf(l.target)].type !== "paper")
      });
      setTimeout(() => fit(0), 50);
    })
    .catch(error => {
      console.error("Research graph error:", error);
      graphContainer.innerHTML = `<div class="graph-error"><strong>Research graph could not be loaded.</strong></div>`;
    });
}
