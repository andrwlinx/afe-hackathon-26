import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfiguredGraph } from "./connectors.js";
import { GraphStore } from "./graph-store.js";
import { QueryEngine } from "./query-engine.js";

async function main(): Promise<void> {
  const loaded = await loadConfiguredGraph();
  const engine = new QueryEngine(new GraphStore(loaded.dataset));
  const server = new McpServer({ name: "ramp-path", version: "0.1.0" });

  const register = (
    name: string,
    description: string,
    question: (input: Record<string, string>) => string,
    schema: Record<string, z.ZodString>
  ) => {
    server.tool(name, description, schema, async (input) => {
      const result = engine.query(question(input as Record<string, string>));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
      };
    });
  };

  register(
    "resolve_owner",
    "Find the verified owner and primary contact for an engineering entity.",
    ({ entity }) => `Who owns ${entity}?`,
    { entity: z.string().describe("Package, pipeline, resource, account, or Bindle name") }
  );
  register(
    "check_access",
    "Check whether a person has a verified access path to perform an action.",
    ({ actor, action, resource }) => `Can ${actor} ${action} ${resource}?`,
    {
      actor: z.string(),
      action: z.string(),
      resource: z.string()
    }
  );
  register(
    "plan_access_request",
    "Identify the missing role, approver, and a drafted access request.",
    ({ actor, action, resource }) =>
      `What access should ${actor} request to ${action} ${resource}?`,
    {
      actor: z.string(),
      action: z.string(),
      resource: z.string()
    }
  );
  register(
    "trace_deployment",
    "Trace a package through its pipeline stages to target accounts.",
    ({ entity }) => `Where does ${entity} deploy?`,
    { entity: z.string().describe("Package or pipeline name") }
  );

  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error(
    `RampPath MCP failed to start: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
