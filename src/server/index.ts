import { createApp } from "./app.js";
import { loadConfiguredGraph } from "./connectors.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

async function main(): Promise<void> {
  const loaded = await loadConfiguredGraph();
  const { app } = createApp({
    dataset: loaded.dataset,
    dataMode: loaded.isPrivate ? "private" : "public",
    expertiseLoaded: loaded.expertiseLoaded
  });

  app.listen(port, host, () => {
    console.log(
      `RampPath API listening at http://${host}:${port} (${loaded.dataset.nodes.length} nodes, ${loaded.dataset.edges.length} edges)`
    );
  });
}

main().catch((error: unknown) => {
  console.error(
    `RampPath failed to start: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
