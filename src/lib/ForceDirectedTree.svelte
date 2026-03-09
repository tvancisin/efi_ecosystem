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

  const MIN_NODE_RADIUS = 6;
  const MAX_NODE_RADIUS = 40;
  const COLLISION_PADDING = 6;
  const ROOT_RADIUS = 80;

  // ── data helpers ─────────────────────────────────────────────────────────────
  function flattenTree(node, parent = null, depth = 0) {
    const childCount = (node.children ?? []).length;
    const flat = { id: node.name, name: node.name, depth, childCount };
    const flatNodes = [flat];
    const flatLinks = [];
    if (parent) flatLinks.push({ source: parent.name, target: node.name });
    for (const child of node.children ?? []) {
      const { nodes: cn, links: cl } = flattenTree(child, node, depth + 1);
      flatNodes.push(...cn);
      flatLinks.push(...cl);
    }
    return { nodes: flatNodes, links: flatLinks };
  }

  // ── simulation ───────────────────────────────────────────────────────────────
  function initSimulation() {
    simulation?.stop();

    const { nodes: rawNodes, links: rawLinks } = flattenTree(data);
    const maxChildCount = d3.max(rawNodes, (d) => d.childCount) ?? 0;
    const radiusScale = d3
      .scaleLinear()
      .domain([0, Math.max(1, maxChildCount)])
      .range([MIN_NODE_RADIUS, MAX_NODE_RADIUS]);

    for (const node of rawNodes) {
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
          .distance(10)
          .strength(1),
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
      simulation?.alpha(0.3).restart();
    });
    resizeObserver.observe(svgEl.parentElement);

    initSimulation();
  });

  onDestroy(() => {
    simulation?.stop();
    resizeObserver?.disconnect();
  });

  // Re-initialise whenever the data prop changes (after first mount)
  $: if (mounted && data) initSimulation();
</script>

<!-- ── template ─────────────────────────────────────────────────────────────── -->
<div
  class="chart-container"
  bind:clientWidth={width}
  bind:clientHeight={height}
>
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
          stroke-width="1.5"
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
        >
          <circle
            r={node.radius ?? MIN_NODE_RADIUS}
            fill="#252525"
            stroke="#fff"
            stroke-width="2"
          />
          {#if node.depth <= 1}
            <text
              x={(node.radius ?? MIN_NODE_RADIUS) + 4}
              y={4}
              font-size="12px"
              fill="#252525"
              pointer-events="none">{node.name}</text
            >
          {/if}
          <title>{node.name} ({node.childCount} children)</title>
        </g>
      {/each}
    </g>
  </svg>
</div>

<style>
  .chart-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: #f8f8f8;
    border-radius: 8px;
    overflow: hidden;
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
    transform: scale(1.4);
  }
</style>
