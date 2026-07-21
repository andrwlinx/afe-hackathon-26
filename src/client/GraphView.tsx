import ForceGraph3D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject
} from "react-force-graph-3d";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  SphereGeometry,
  Vector3
} from "three";
import type { GraphPath } from "../shared/graph.js";
import {
  buildGraph3DData,
  type GraphLink3D,
  type GraphNode3D
} from "./graph-layout.js";

type GraphNodeObject = NodeObject<GraphNode3D>;
type GraphLinkObject = LinkObject<GraphNode3D, GraphLink3D>;

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}

function createNodeObject(
  node: GraphNodeObject,
  selected: boolean,
  compact: boolean
): Object3D {
  const radius = compact ? 10 : 8;
  const color = selected
    ? "#f7fafc"
    : node.status === "missing"
      ? "#c53f3f"
      : "#e47911";
  return new Mesh(
    new SphereGeometry(radius, 20, 16),
    new MeshLambertMaterial({ color })
  );
}

function createLink(link: GraphLinkObject): Object3D {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
  const material =
    link.status === "missing"
      ? new LineDashedMaterial({
          color: "#c53f3f",
          dashSize: 7,
          gapSize: 5,
          transparent: true,
          opacity: 0.95
        })
      : new LineBasicMaterial({
          color: "#91a0b4",
          transparent: true,
          opacity: 0.78
        });
  return new Line(geometry, material);
}

function updateLinkPosition(
  object: Object3D,
  coordinates: {
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
  }
): boolean {
  const line = object as Line<BufferGeometry>;
  const position = line.geometry.getAttribute("position") as BufferAttribute;
  position.setXYZ(
    0,
    coordinates.start.x,
    coordinates.start.y,
    coordinates.start.z
  );
  position.setXYZ(
    1,
    coordinates.end.x,
    coordinates.end.y,
    coordinates.end.z
  );
  position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
  line.computeLineDistances();
  return true;
}

function connectionText(
  node: GraphNode3D,
  links: GraphLink3D[],
  nodes: GraphNode3D[]
): string[] {
  const labels = new Map(nodes.map((item) => [item.id, item.label]));
  const endpointId = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (
      value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string"
    ) {
      return value.id;
    }
    return undefined;
  };
  return links
    .filter(
      (link) =>
        endpointId(link.source) === node.id || endpointId(link.target) === node.id
    )
    .map((link) => {
      const source = endpointId(link.source);
      const target = endpointId(link.target);
      const outbound = source === node.id;
      const otherId = outbound ? target : source;
      const direction = outbound ? "to" : "from";
      const otherLabel = otherId ? labels.get(otherId) ?? otherId : "unknown";
      return `${link.label} ${direction} ${otherLabel}`;
    });
}

export function GraphView({ path }: { path: GraphPath }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<string, HTMLSpanElement>());
  const graphRef =
    useRef<ForceGraphMethods<GraphNode3D, GraphLink3D>>(undefined);
  const graphData = useMemo(() => buildGraph3DData(path), [path]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState(path.nodes[0]?.id ?? "");
  const [webglAvailable, setWebglAvailable] = useState(true);
  const reduceMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const graphCenter = useMemo(() => {
    const totals = graphData.nodes.reduce(
      (sum, node) => ({
        x: sum.x + node.fx,
        y: sum.y + node.fy,
        z: sum.z + node.fz
      }),
      { x: 0, y: 0, z: 0 }
    );
    const count = Math.max(graphData.nodes.length, 1);
    return {
      x: totals.x / count,
      y: totals.y / count,
      z: totals.z / count
    };
  }, [graphData]);

  const resetCamera = useCallback(
    (duration: number) => {
      if (!graphData.nodes.length || !dimensions.width || !dimensions.height) {
        return;
      }
      const xValues = graphData.nodes.map((node) => node.fx);
      const yValues = graphData.nodes.map((node) => node.fy);
      const zValues = graphData.nodes.map((node) => node.fz);
      const spanX = Math.max(...xValues) - Math.min(...xValues);
      const spanY = Math.max(...yValues) - Math.min(...yValues);
      const spanZ = Math.max(...zValues) - Math.min(...zValues);
      const aspect = dimensions.width / dimensions.height;
      const halfFovTangent = Math.tan((45 * Math.PI) / 360);
      const horizontalDistance =
        Math.max(spanX, 180) / 2 / halfFovTangent / Math.max(aspect, 0.72);
      const verticalDistance =
        Math.max(spanY, 120) / 2 / halfFovTangent;
      const distance =
        Math.max(horizontalDistance, verticalDistance, spanZ * 2.5, 480) * 1.08;

      graphRef.current?.cameraPosition(
        {
          x: graphCenter.x + distance * 0.08,
          y: graphCenter.y + distance * 0.05,
          z: graphCenter.z + distance
        },
        graphCenter,
        duration
      );
    },
    [dimensions, graphCenter, graphData]
  );

  useEffect(() => {
    setSelectedId(path.nodes[0]?.id ?? "");
  }, [path]);

  useEffect(() => {
    setWebglAvailable(supportsWebGL());
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height)
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !graphData.nodes.length) return;
    const frame = window.requestAnimationFrame(() => {
      resetCamera(reduceMotion ? 0 : 450);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dimensions, graphData, reduceMotion, resetCamera]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height || !graphData.nodes.length) {
      return;
    }
    let frame = 0;
    const updateLabels = () => {
      const graph = graphRef.current;
      if (graph) {
        for (const node of graphData.nodes) {
          const element = labelRefs.current.get(node.id);
          if (!element) continue;
          const position = graph.graph2ScreenCoords(node.fx, node.fy, node.fz);
          const visible =
            position.x >= -80 &&
            position.x <= dimensions.width + 80 &&
            position.y >= -40 &&
            position.y <= dimensions.height + 80;
          element.style.visibility = visible ? "visible" : "hidden";
          element.style.transform =
            `translate3d(${position.x}px, ${position.y}px, 0) ` +
            "translate(-50%, calc(-100% - 14px))";
        }
      }
      frame = window.requestAnimationFrame(updateLabels);
    };
    frame = window.requestAnimationFrame(updateLabels);
    return () => window.cancelAnimationFrame(frame);
  }, [dimensions, graphData]);

  const selectedNode =
    graphData.nodes.find((node) => node.id === selectedId) ?? graphData.nodes[0];
  const selectedConnections = selectedNode
    ? connectionText(selectedNode, graphData.links, graphData.nodes)
    : [];

  const focusNode = useCallback(
    (node: GraphNodeObject) => {
      setSelectedId(node.id);
      const camera = graphRef.current?.camera();
      if (!camera) return;
      const target = new Vector3(node.fx, node.fy, node.fz);
      const direction = camera.position.clone().sub(target);
      if (direction.lengthSq() < 1) direction.set(0, 0, 1);
      direction.normalize().multiplyScalar(118);
      const position = target.clone().add(direction);
      graphRef.current?.cameraPosition(
        { x: position.x, y: position.y, z: position.z },
        { x: target.x, y: target.y, z: target.z },
        reduceMotion ? 0 : 350
      );
    },
    [reduceMotion]
  );

  const zoom = useCallback(
    (factor: number) => {
      const camera = graphRef.current?.camera();
      if (!camera) return;
      const center = new Vector3(graphCenter.x, graphCenter.y, graphCenter.z);
      const position = camera.position
        .clone()
        .sub(center)
        .multiplyScalar(factor)
        .add(center);
      graphRef.current?.cameraPosition(
        { x: position.x, y: position.y, z: position.z },
        graphCenter,
        reduceMotion ? 0 : 220
      );
    },
    [graphCenter, reduceMotion]
  );

  if (!path.nodes.length) {
    return <div className="graph-empty">No verified path found</div>;
  }

  return (
    <div className="graph-experience">
      <div className="graph-toolbar">
        <div className="legend" aria-label="Connection status legend">
          <span><i className="verified-line" /> Verified</span>
          <span><i className="missing-line" /> Missing</span>
        </div>
        <div className="graph-actions">
          <button
            type="button"
            onClick={() => zoom(0.82)}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={17} />
          </button>
          <button
            type="button"
            onClick={() => zoom(1.22)}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={17} />
          </button>
          <button
            type="button"
            onClick={() => resetCamera(reduceMotion ? 0 : 350)}
            title="Reset graph view"
            aria-label="Reset graph view"
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>

      <div className="graph-stage">
        <div
          className="graph-canvas"
          ref={containerRef}
          role="img"
          aria-label="Interactive three-dimensional knowledge graph path"
        >
          {webglAvailable && dimensions.width && dimensions.height ? (
            <>
              <ForceGraph3D<GraphNode3D, GraphLink3D>
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                backgroundColor="#151b27"
                rendererConfig={{
                  alpha: false,
                  antialias: true,
                  preserveDrawingBuffer: true
                }}
                showNavInfo={false}
                warmupTicks={0}
                cooldownTicks={0}
                enableNodeDrag={false}
                nodeLabel={(node) => `${node.label} · ${node.type}`}
                nodeThreeObject={(node) =>
                  createNodeObject(
                    node,
                    node.id === selectedId,
                    dimensions.width < 600
                  )
                }
                linkThreeObject={createLink}
                linkPositionUpdate={updateLinkPosition}
                linkDirectionalArrowLength={5}
                linkDirectionalArrowRelPos={0.84}
                linkDirectionalArrowColor={(link) =>
                  link.status === "missing" ? "#c53f3f" : "#b8c2cf"
                }
                onNodeClick={focusNode}
                showPointerCursor
              />
              <div className="graph-label-layer" aria-hidden="true">
                {graphData.nodes.map((node) => (
                  <span
                    key={node.id}
                    ref={(element) => {
                      if (element) labelRefs.current.set(node.id, element);
                      else labelRefs.current.delete(node.id);
                    }}
                    className={[
                      node.status === "missing" ? "missing" : "",
                      node.id === selectedId ? "selected" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {node.label}
                  </span>
                ))}
              </div>
            </>
          ) : webglAvailable ? null : (
            <div className="webgl-fallback">
              3D rendering is unavailable. Use the path navigator to inspect this answer.
            </div>
          )}
        </div>

        {selectedNode ? (
          <aside className="node-inspector" aria-live="polite">
            <span className="section-label">Selected entity</span>
            <h3>{selectedNode.label}</h3>
            <span className={`node-type status-${selectedNode.status}`}>
              {selectedNode.type}
            </span>
            {selectedNode.description ? <p>{selectedNode.description}</p> : null}
            <div className="connection-list">
              <span>Connections</span>
              {selectedConnections.length ? (
                selectedConnections.map((connection) => (
                  <p key={connection}>{connection}</p>
                ))
              ) : (
                <p>No connected entity in this path.</p>
              )}
            </div>
            <div className="path-navigator" aria-label="Path entities">
              {graphData.nodes.map((node, index) => (
                <button
                  type="button"
                  key={node.id}
                  className={node.id === selectedNode.id ? "selected" : ""}
                  onClick={() => focusNode(node)}
                  aria-pressed={node.id === selectedNode.id}
                >
                  <span>{index + 1}</span>
                  {node.label}
                </button>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
