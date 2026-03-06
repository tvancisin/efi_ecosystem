<script>
  import { onMount } from "svelte";
  import ForceDirectedTree from "./lib/ForceDirectedTree.svelte";
  import { datasetsStore, loadData } from "./datastore.js";

  let data;

  onMount(() => {
    const unsubscribe = datasetsStore.subscribe((storeData) => {
      if (!storeData) return;

      ({ data } = storeData);
    });

    loadData();

    return unsubscribe;
  });

  $: console.log(data);
  

  const treeData = {
    name: "EFI Ecosystem",
    children: [
      {
        name: "Producers",
        children: [
          { name: "Phytoplankton" },
          { name: "Macroalgae" },
          { name: "Seagrass" },
        ],
      },
      {
        name: "Consumers",
        children: [
          {
            name: "Primary",
            children: [{ name: "Zooplankton" }, { name: "Small Fish" }],
          },
          {
            name: "Secondary",
            children: [{ name: "Medium Fish" }, { name: "Crustaceans" }],
          },
          {
            name: "Tertiary",
            children: [{ name: "Large Fish" }, { name: "Marine Mammals" }],
          },
        ],
      },
      {
        name: "Decomposers",
        children: [{ name: "Bacteria" }, { name: "Fungi" }],
      },
      {
        name: "Abiotic Factors",
        children: [
          { name: "Sunlight" },
          { name: "Nutrients" },
          { name: "Temperature" },
          { name: "Salinity" },
        ],
      },
    ],
  };
</script>

<div class="app">
  <header>
    <h1>EFI Ecosystem</h1>
    <p class="subtitle">Force-Directed Tree Visualization</p>
  </header>

  <div class="legend">
    <span class="hint"
      >🖱 Drag nodes &nbsp;·&nbsp; Scroll to zoom &nbsp;·&nbsp; Drag canvas to
      pan</span
    >
  </div>

  <main>
    <ForceDirectedTree data={treeData} />
  </main>
</div>

<style>
  :global(body) {
    background: #0f172a;
    color: #e2e8f0;
    font-family: "Segoe UI", system-ui, sans-serif;
    min-height: 100vh;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 1rem;
    gap: 0.5rem;
  }

  header {
    text-align: center;
    padding: 0.5rem 0;
  }

  h1 {
    font-size: clamp(1.4rem, 4vw, 2rem);
    font-weight: 700;
    background: linear-gradient(135deg, #38bdf8, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin-top: 0.25rem;
  }

  .legend {
    text-align: center;
  }

  .hint {
    font-size: 0.75rem;
    color: #64748b;
  }

  main {
    flex: 1;
    overflow: hidden;
  }
</style>
