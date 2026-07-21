import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useRef } from "react";
import type { GraphPath, NodeType } from "../shared/graph.js";

const nodeColors: Record<NodeType, string> = {
  person: "#147d72",
  team: "#0d5f92",
  package: "#6d4cc4",
  pipeline: "#b34f28",
  stage: "#cc7a13",
  account: "#2f6b45",
  bindle: "#a23b58",
  role: "#455a75",
  resource: "#1b6f82"
};

function compactLabel(label: string): string {
  return label
    .replace(/([a-z])([A-Z])/g, "$1\n$2")
    .replace(/-region-/g, "-region-\n");
}

export function GraphView({ path }: { path: GraphPath }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const compact = containerRef.current.clientWidth < 520;

    const elements: ElementDefinition[] = [
      ...path.nodes.map((node) => ({
        data: {
          id: node.id,
          label: compact ? compactLabel(node.label) : node.label,
          type: node.type,
          color: nodeColors[node.type]
        }
      })),
      ...path.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.from,
          target: edge.to,
          label: edge.label,
          status: edge.status
        }
      }))
    ];

    graphRef.current?.destroy();
    graphRef.current = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.55,
      maxZoom: 1.8,
      wheelSensitivity: 0.18,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            label: "data(label)",
            color: "#172033",
            "font-family": "Source Sans 3, ui-sans-serif, system-ui",
            "font-size": compact ? 10 : 11,
            "font-weight": 650,
            "text-wrap": "wrap",
            "text-max-width": compact ? "84px" : "120px",
            "text-valign": "bottom",
            "text-margin-y": 9,
            width: 38,
            height: 38,
            "border-width": 4,
            "border-color": "#ffffff",
            "overlay-opacity": 0
          }
        },
        {
          selector: "edge",
          style: {
            width: 2,
            label: "",
            "line-color": "#9aa6b6",
            "target-arrow-color": "#9aa6b6",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.8,
            "overlay-opacity": 0
          }
        },
        {
          selector: 'edge[status = "missing"]',
          style: {
            "line-style": "dashed",
            "line-color": "#c53f3f",
            "target-arrow-color": "#c53f3f",
            color: "#a82e2e"
          }
        }
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: compact ? 1.55 : 1.35,
        padding: 36,
        animate: false
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      graphRef.current?.resize();
      graphRef.current?.fit(undefined, 36);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      graphRef.current?.destroy();
      graphRef.current = null;
    };
  }, [path]);

  if (!path.nodes.length) {
    return (
      <div className="graph-empty">
        <span>No verified path found</span>
      </div>
    );
  }

  return (
    <div
      className="graph-canvas"
      ref={containerRef}
      role="img"
      aria-label="Knowledge graph path for this answer"
    />
  );
}
