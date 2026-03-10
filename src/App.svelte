<script>
  import { onMount } from "svelte";
  import ForceDirectedTree from "./lib/ForceDirectedTree.svelte";
  import { datasetsStore, loadData } from "./datastore.js";

  let data, hierarchy;

  onMount(() => {
    const unsubscribe = datasetsStore.subscribe((storeData) => {
      if (!storeData) return;

      ({ data, hierarchy } = storeData);
    });

    loadData();
    return unsubscribe;
  });
</script>

<div class="app">
  <main>
    <ForceDirectedTree data={hierarchy} />
  </main>
</div>

<style>
  :global(body) {
    background: #0f172a;
    color: #e2e8f0;
    min-height: 100vh;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 1rem;
    gap: 0.5rem;
  }

  main {
    flex: 1;
    overflow: hidden;
  }
</style>
