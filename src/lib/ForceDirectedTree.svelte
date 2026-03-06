<script>
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';

  export let data = {
    name: 'Root',
    children: []
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

  const NODE_RADIUS = 8;
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

  // ── data helpers ─────────────────────────────────────────────────────────────
  function flattenTree(node, parent = null, depth = 0) {
    const flat = { id: node.name, name: node.name, depth };
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

    simulation = d3
      .forceSimulation(rawNodes)
      .force(
        'link',
        d3.forceLink(rawLinks).id(d => d.id).distance(80).strength(1)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(NODE_RADIUS + 10))
      .on('tick', () => {
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
      event.clientY - rect.top
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
      .on('zoom', event => (transform = event.transform));
    d3.select(svgEl).call(zoom);

    resizeObserver = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      simulation?.force('center', d3.forceCenter(width / 2, height / 2));
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
<div class="chart-container" bind:clientWidth={width} bind:clientHeight={height}>
  <svg
    bind:this={svgEl}
    {width}
    {height}
    aria-label="Force-directed tree visualization"
  >
    <defs>
      <marker
        id="arrowhead"
        viewBox="-0 -5 10 10"
        refX={NODE_RADIUS + 10}
        refY="0"
        orient="auto"
        markerWidth="6"
        markerHeight="6"
      >
        <path d="M 0,-5 L 10,0 L 0,5" fill="#94a3b8" />
      </marker>
    </defs>

    <!-- All content lives inside a single <g> driven by the zoom transform -->
    <g transform={transform.toString()}>

      <!-- Links -->
      {#each links as link (`${link.source.id}-${link.target.id}`)}
        <line
          x1={link.source.x ?? 0}
          y1={link.source.y ?? 0}
          x2={link.target.x ?? 0}
          y2={link.target.y ?? 0}
          stroke="#94a3b8"
          stroke-width="1.5"
          marker-end="url(#arrowhead)"
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
          on:pointerdown={e => onPointerDown(e, node)}
          on:pointermove={e => onPointerMove(e, node)}
          on:pointerup={e => onPointerUp(e, node)}
          on:pointercancel={e => onPointerUp(e, node)}
        >
          <circle
            r={NODE_RADIUS}
            fill={colorScale(node.depth)}
            stroke="#fff"
            stroke-width="2"
          />
          <text
            x={NODE_RADIUS + 4}
            y={4}
            font-size="12px"
            fill="#e2e8f0"
            pointer-events="none"
          >{node.name}</text>
          <title>{node.name}</title>
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
    background: #0f172a;
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

