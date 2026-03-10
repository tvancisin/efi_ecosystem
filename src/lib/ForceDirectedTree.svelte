<script>
  import { onMount, onDestroy } from "svelte";
  import * as d3 from "d3";

  export let data = {
    name: "Root",
    children: [],
  };

  // ── reactive state ───────────────────────────────────────────────────────────
  let svgEl;
  let width = 800;
  let height = 600;
  let nodes = [];
  let links = [];
  let transform = d3.zoomIdentity;

  // ── internals ────────────────────────────────────────────────────────────────
  let simulation;
  let resizeObserver;
  let draggingNode = null;
  let mounted = false;
  let activeData = data;

  const MIN_NODE_RADIUS = 5;
  const MAX_NODE_RADIUS = 50;
  const COLLISION_PADDING = 5;
  const ROOT_RADIUS = 60;
  const DEFAULT_LINK_DISTANCE = 10;
  const DEFAULT_LINK_STRENGTH = 1;
  const SHALLOW_LINK_DISTANCE = 150;
  const SHALLOW_LINK_STRENGTH = 0.1;

  // ── data helpers ─────────────────────────────────────────────────────────────
  function flattenTree(
    node,
    parentFlat = null,
    depth = 0,
    pathKey = node.name,
  ) {
    const childCount = (node.children ?? []).length;
    const flat = {
      id: pathKey,
      name: node.name,
      depth,
      childCount,
      treeNode: node,
    };
    const flatNodes = [flat];
    const flatLinks = [];
    if (parentFlat) {
      flatLinks.push({ source: parentFlat.id, target: flat.id });
    }
    for (const [index, child] of (node.children ?? []).entries()) {
      const childPath = `${pathKey}/${child.name}-${index}`;
      const { nodes: cn, links: cl } = flattenTree(
        child,
        flat,
        depth + 1,
        childPath,
      );
      flatNodes.push(...cn);
      flatLinks.push(...cl);
    }
    return { nodes: flatNodes, links: flatLinks };
  }

  // ── simulation ───────────────────────────────────────────────────────────────
  function initSimulation() {
    simulation?.stop();

    const treeData = activeData ?? data;
    if (!treeData) {
      nodes = [];
      links = [];
      return;
    }

    const { nodes: rawNodes, links: rawLinks } = flattenTree(treeData);
    const maxDepth = d3.max(rawNodes, (d) => d.depth) ?? 0;
    const isShallowSubtree = maxDepth <= 1;
    const linkDistance = isShallowSubtree
      ? SHALLOW_LINK_DISTANCE
      : DEFAULT_LINK_DISTANCE;
    const linkStrength = isShallowSubtree
      ? SHALLOW_LINK_STRENGTH
      : DEFAULT_LINK_STRENGTH;
    const maxChildCount = d3.max(rawNodes, (d) => d.childCount) ?? 0;
    const radiusScale = d3
      .scaleLinear()
      .domain([0, Math.max(1, maxChildCount)])
      .range([MIN_NODE_RADIUS, MAX_NODE_RADIUS]);

    for (const node of rawNodes) {
      node.textEl = null; // placeholder for later DOM reference
      const scaled = radiusScale(node.childCount);
      node.radius = node.depth === 0 ? ROOT_RADIUS : scaled;
      node.collisionRadius =
        node.depth === 0 ? ROOT_RADIUS * 0.55 : node.radius * 0.8;
    }

    simulation = d3
      .forceSimulation(rawNodes)
      .force(
        "link",
        d3
          .forceLink(rawLinks)
          .id((d) => d.id)
          .distance(linkDistance)
          .strength(linkStrength),
      )
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide(
          (d) => (d.radius ?? MIN_NODE_RADIUS) + COLLISION_PADDING,
        ),
      )
      .on("tick", () => {
        // Reassigning array references triggers Svelte reactivity;
        // D3 mutates the objects in-place, so a shallow copy suffices.
        nodes = rawNodes.slice();
        links = rawLinks.slice();
      });
  }

  // ── drag handlers (pointer events on SVG <g> elements) ──────────────────────
  function onPointerDown(event, node) {
    event.stopPropagation(); // prevent zoom from consuming the event
    draggingNode = node;
    node.fx = node.x;
    node.fy = node.y;
    simulation?.alphaTarget(0.3).restart();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event, node) {
    if (draggingNode !== node) return;
    const rect = svgEl.getBoundingClientRect();
    const [x, y] = transform.invert([
      event.clientX - rect.left,
      event.clientY - rect.top,
    ]);
    node.fx = x;
    node.fy = y;
  }

  function onPointerUp(event, node) {
    if (draggingNode !== node) return;
    draggingNode = null;
    node.fx = null;
    node.fy = null;
    simulation?.alphaTarget(0);
  }

  function onNodeClick(event, node) {
    event.stopPropagation();
    if (!node?.treeNode) return;
    activeData = node.treeNode;

    initSimulation();
  }

  function onNodeKeyDown(event, node) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onNodeClick(event, node);
  }

  function resetToDefaultData() {
    if (!data || activeData === data) return;
    activeData = data;
    initSimulation();
  }

  function getLinkStrokeWidth(link) {
    const targetDepth = link?.target?.depth ?? 0;

    if (targetDepth <= 1) return 4;
    if (targetDepth === 2) return 2;
    return 1;
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────
  onMount(() => {
    mounted = true;

    const zoom = d3
      .zoom()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => (transform = event.transform));

    d3.select(svgEl).call(zoom);

    resizeObserver = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      simulation?.force("center", d3.forceCenter(width / 2, height / 2));
      simulation?.alpha(0.2).restart();
    });
    resizeObserver.observe(svgEl.parentElement);

    initSimulation();
  });

  onDestroy(() => {
    simulation?.stop();
    resizeObserver?.disconnect();
  });

  // Re-initialise whenever the data prop changes (after first mount)
  $: if (mounted && data) {
    activeData = data;
    initSimulation();
  }

  $: {
    if (nodes.length) {
      for (const node of nodes) {
        if (node.textEl) {
          node.bbox = node.textEl.getBBox();
        }
      }
    }
  }
</script>

<div
  class="chart-container"
  bind:clientWidth={width}
  bind:clientHeight={height}
>
  <div class="dataset-control">
    <label for="dataset-select">Dataset</label>
    <select id="dataset-select" aria-label="Select dataset">
      <option value="Ecosystem" selected>Ecosystem</option>
      <option value="Events">Events</option>
      <option value="People">People</option>
      <option value="Programmes">Programmes</option>
    </select>
  </div>

  <button
    class="reset-view-btn"
    type="button"
    aria-label="Reset to default dataset"
    on:click={resetToDefaultData}
    disabled={activeData === data}
  >
    Reset
  </button>

  <svg
    bind:this={svgEl}
    {width}
    {height}
    aria-label="Force-directed tree visualization"
  >
    <!-- All content lives inside a single <g> driven by the zoom transform -->
    <g transform={transform.toString()}>
      <!-- Links -->
      {#each links as link (`${link.source.id}-${link.target.id}`)}
        <line
          x1={link.source.x ?? 0}
          y1={link.source.y ?? 0}
          x2={link.target.x ?? 0}
          y2={link.target.y ?? 0}
          stroke="gray"
          stroke-width={getLinkStrokeWidth(link)}
        />
      {/each}

      <!-- Nodes -->
      {#each nodes as node (node.id)}
        <g
          role="button"
          tabindex="0"
          aria-label={node.name}
          class="node"
          transform="translate({node.x ?? 0},{node.y ?? 0})"
          on:click={(event) => onNodeClick(event, node)}
          on:keydown={(event) => onNodeKeyDown(event, node)}
        >
          <circle
            r={node.radius ?? MIN_NODE_RADIUS}
            fill={node.name === "EFI" ? "#383A40" : "black"}
          />
          <title>{node.name} ({node.childCount} children)</title>
        </g>
      {/each}

      {#each nodes as node (node.id)}
        <g
          role="button"
          tabindex="0"
          aria-label={node.name}
          class="node"
          transform="translate({node.x ?? 0},{node.y ?? 0})"
          on:click={(event) => onNodeClick(event, node)}
          on:keydown={(event) => onNodeKeyDown(event, node)}
        >
          {#if node.depth <= 1}
            {#if node.bbox}
              <rect
                x={node.bbox.x - 2}
                y={node.bbox.y - 1}
                width={node.bbox.width + 4}
                height={node.bbox.height + 4}
                fill="black"
                rx="4"
                opacity="0.7"
              />
            {/if}
            <text
              bind:this={node.textEl}
              x={node.name == "EFI" ? 0 : (node.radius ?? MIN_NODE_RADIUS) + 4}
              text-anchor={node.name === "EFI" ? "middle" : "start"}
              y={4}
              font-size="14px"
              font-weight={node.depth === 0 ? "bold" : "normal"}
              fill={node.name === "EFI" ? "white" : "white"}
              pointer-events="none">{node.name}</text
            >
          {/if}
        </g>
      {/each}
    </g>
  </svg>
</div>

<style>
  .chart-container {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: #f8f8f8;
    border-radius: 8px;
    overflow: hidden;
  }

  .dataset-control {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    border: 1px solid #d8d8d8;
  }

  .dataset-control label {
    font-size: 12px;
    color: #333;
  }

  .dataset-control select {
    font-size: 12px;
    padding: 4px 6px;
    border: 1px solid #bbb;
    border-radius: 4px;
    background: #fff;
    color: #222;
  }

  .reset-view-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    font-size: 12px;
    padding: 6px 10px;
    border: 1px solid #d8d8d8;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.95);
    color: #222;
    cursor: pointer;
  }

  .reset-view-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  svg {
    display: block;
    cursor: grab;
  }

  svg:active {
    cursor: grabbing;
  }

  .node {
    cursor: pointer;
  }

  .node circle {
    transition: transform 0.15s ease;
    transform-origin: center;
    transform-box: fill-box;
  }

  .node:hover circle {
    transform: scale(1.1);
  }
</style>
