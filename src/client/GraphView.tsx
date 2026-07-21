import ForceGraph3D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject
} from "react-force-graph-3d";
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Maximize2,
  Minimize2,
  X
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  PMREMGenerator,
  RingGeometry,
  Vector2,
  Vector3,
  type Scene,
  type WebGLRenderer
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { GraphPath } from "../shared/graph.js";
import {
  buildGraph3DData,
  type GraphLink3D,
  type GraphNode3D
} from "./graph-layout.js";

type GraphNodeObject = NodeObject<GraphNode3D>;
type GraphLinkObject = LinkObject<GraphNode3D, GraphLink3D>;

// Gem palette. Each entity type gets its own jewel tone so the graph reads as a
// set of distinct crystals rather than identical beads; missing links glow red.
const GEM_COLORS: Record<string, string> = {
  person: "#38e0c4",
  team: "#5fb2ff",
  package: "#7c8cff",
  pipeline: "#b98bff",
  stage: "#59d0ff",
  account: "#ffcf5c",
  bindle: "#ff9f6b",
  role: "#ff7ea8",
  resource: "#8be26a"
};
const VERIFIED_FALLBACK = "#38e0c4";
const MISSING_COLOR = "#ff5f6d";
const SELECTED_RING = "#f4f9ff";

function gemColor(node: GraphNode3D): string {
  if (node.status === "missing") return MISSING_COLOR;
  return GEM_COLORS[node.type] ?? VERIFIED_FALLBACK;
}

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

// A faceted crystal: a physical, light-transmitting icosahedron core wrapped in
// a fainter outer shell that catches the environment reflections, plus a
// selection ring that only shows on the active node.
function createNodeObject(
  node: GraphNodeObject,
  selected: boolean,
  compact: boolean
): Object3D {
  const radius = compact ? 9 : 7.5;
  const color = new Color(gemColor(node));
  const group = new Group();

  const gem = new Mesh(
    new IcosahedronGeometry(radius, 0),
    new MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.05,
      // Modest transmission: enough to read as cut glass, but low enough that
      // the gem never turns into a dark hole against the near-black backdrop.
      transmission: 0.35,
      thickness: radius,
      ior: 2.4,
      // Sharp clearcoat + low roughness is what makes the facets flash as the
      // environment map slides across them during rotation.
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      reflectivity: 0.6,
      iridescence: 0.6,
      iridescenceIOR: 1.5,
      attenuationColor: color.clone(),
      attenuationDistance: radius * 2.5,
      // Emissive keeps the jewel self-lit from any angle and feeds the bloom
      // pass so each node glows like a lit gemstone.
      emissive: color.clone(),
      emissiveIntensity: selected ? 0.9 : 0.5,
      flatShading: true
    })
  );
  group.add(gem);

  // Faint outer facet shell — a slightly larger, low-opacity icosahedron that
  // adds depth and a glassy rim without hiding the core.
  const halo = new Mesh(
    new IcosahedronGeometry(radius * 1.32, 0),
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: selected ? 0.24 : 0.12,
      // BackSide so we see the far facets glowing through the front.
      side: BackSide
    })
  );
  group.add(halo);

  if (selected) {
    const ring = new Mesh(
      new RingGeometry(radius * 1.7, radius * 1.92, 48),
      new MeshBasicMaterial({
        color: new Color(SELECTED_RING),
        transparent: true,
        opacity: 0.9,
        side: DoubleSide
      })
    );
    // Billboarded toward the camera each frame in the render loop.
    ring.userData.isSelectionRing = true;
    group.add(ring);
  }

  group.userData.gemColor = color.getHex();
  return group;
}

function createLink(link: GraphLinkObject): Object3D {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
  const material =
    link.status === "missing"
      ? new LineDashedMaterial({
          color: MISSING_COLOR,
          dashSize: 7,
          gapSize: 5,
          transparent: true,
          opacity: 0.95
        })
      : new LineBasicMaterial({
          color: "#5f7396",
          transparent: true,
          opacity: 0.6
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
  const experienceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<string, HTMLSpanElement>());
  const graphRef =
    useRef<ForceGraphMethods<GraphNode3D, GraphLink3D>>(undefined);
  const graphData = useMemo(() => buildGraph3DData(path), [path]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // No node is selected until the user clicks a gem; the popup is closed by
  // default so the map reads clean.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reduceMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  // The map spins constantly; we only suppress it while the user is actively
  // dragging so their gesture isn't fought. Reduced-motion users get no spin.
  const draggingRef = useRef(false);

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
    setSelectedId(null);
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

  // Track native fullscreen state so the button icon/label stays honest even
  // when the user exits via Escape.
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === experienceRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const element = experienceRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    if (!dimensions.width || !graphData.nodes.length) return;
    const frame = window.requestAnimationFrame(() => {
      resetCamera(reduceMotion ? 0 : 450);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dimensions, graphData, reduceMotion, resetCamera]);

  // Scene dressing: environment map for gem reflections + a bloom pass for the
  // jewel sparkle, over a plain black background. Runs once the graph instance
  // mounts and the size is known.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !webglAvailable || !dimensions.width || !dimensions.height) {
      return;
    }
    const renderer = graph.renderer() as WebGLRenderer;
    const scene = graph.scene() as Scene;

    const pmrem = new PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTexture = pmrem.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTexture;
    roomEnv.dispose();
    pmrem.dispose();

    const composer = graph.postProcessingComposer();
    const bloom = new UnrealBloomPass(
      new Vector2(dimensions.width, dimensions.height),
      0.9, // strength
      0.7, // radius
      0.15 // threshold
    );
    composer.addPass(bloom);

    return () => {
      composer.removePass(bloom);
      bloom.dispose();
      if (scene.environment === envTexture) scene.environment = null;
      envTexture.dispose();
    };
  }, [webglAvailable, dimensions]);

  // Single per-frame loop: HTML label positioning, constant idle rotation, and
  // selection-ring billboarding. We drive this ourselves rather than via
  // onEngineTick, because the force sim stops after cooldown (cooldownTicks=0)
  // while the renderer keeps drawing every frame. TrackballControls re-derives
  // its state from the live camera position each frame, so rotating the camera
  // here cooperates with damping instead of fighting it.
  useEffect(() => {
    if (!dimensions.width || !dimensions.height || !graphData.nodes.length) {
      return;
    }
    let frame = 0;
    const fallbackCenter = new Vector3(
      graphCenter.x,
      graphCenter.y,
      graphCenter.z
    );
    const center = new Vector3();
    const offset = new Vector3();
    const spin = 0.0006; // radians/frame around the vertical axis

    const tick = () => {
      const graph = graphRef.current;
      if (graph) {
        const camera = graph.camera();

        // Spin always, except while the user is actively dragging or when the
        // user prefers reduced motion.
        if (!reduceMotion && !draggingRef.current) {
          // Pivot around the live orbit target (a focused node, or the graph
          // center by default) so focusing a gem never re-frames the scene.
          const controls = graph.controls() as { target?: Vector3 };
          if (controls?.target) center.copy(controls.target);
          else center.copy(fallbackCenter);

          offset.copy(camera.position).sub(center);
          const cos = Math.cos(spin);
          const sin = Math.sin(spin);
          const x = offset.x * cos - offset.z * sin;
          const z = offset.x * sin + offset.z * cos;
          offset.x = x;
          offset.z = z;
          camera.position.copy(center).add(offset);
          camera.lookAt(center.x, center.y, center.z);
        }

        const scene = graph.scene() as Scene;
        scene.traverse((object) => {
          if (object.userData?.isSelectionRing) {
            object.quaternion.copy(camera.quaternion);
          }
        });

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
            "translate(-50%, calc(-100% - 16px))";
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [dimensions, graphData, graphCenter, reduceMotion]);

  const selectedNode = selectedId
    ? graphData.nodes.find((node) => node.id === selectedId) ?? null
    : null;
  const selectedIndex = selectedNode
    ? graphData.nodes.findIndex((node) => node.id === selectedNode.id)
    : -1;
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

  const stepSelection = useCallback(
    (delta: number) => {
      if (selectedIndex < 0) return;
      const next = graphData.nodes[selectedIndex + delta];
      if (next) focusNode(next);
    },
    [selectedIndex, graphData, focusNode]
  );

  if (!path.nodes.length) {
    return <div className="graph-empty">No verified path found</div>;
  }

  return (
    <div className="graph-experience" ref={experienceRef}>
      <div className="graph-toolbar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="legend" aria-label="Connection status legend">
          <span><i className="verified-line" /> Verified</span>
          <span><i className="missing-line" /> Missing</span>
        </div>
        <div className="graph-actions">
          <button
            type="button"
            className="graph-control"
            onClick={() => resetCamera(reduceMotion ? 0 : 420)}
          >
            <Crosshair size={15} />
            Recenter
          </button>
          <button
            type="button"
            className="graph-control"
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </div>

      <div className="graph-stage">
        <div
          className="graph-canvas"
          ref={containerRef}
          role="img"
          aria-label="Interactive three-dimensional knowledge graph path"
          onPointerDown={() => {
            draggingRef.current = true;
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerLeave={() => {
            draggingRef.current = false;
          }}
        >
          {webglAvailable && dimensions.width && dimensions.height ? (
            <>
              <ForceGraph3D<GraphNode3D, GraphLink3D>
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                controlType="trackball"
                backgroundColor="#000000"
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
                  link.status === "missing" ? MISSING_COLOR : "#8fa4c6"
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

              {selectedNode ? (
                <aside
                  className="gem-popup"
                  aria-live="polite"
                  key={selectedNode.id}
                >
                  <div className="gem-popup-head">
                    <span className="section-label">Selected entity</span>
                    <button
                      type="button"
                      className="gem-popup-close"
                      onClick={() => setSelectedId(null)}
                      title="Close"
                      aria-label="Close entity details"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <h3>{selectedNode.label}</h3>
                  <span className={`node-type status-${selectedNode.status}`}>
                    {selectedNode.type}
                  </span>
                  {selectedNode.description ? (
                    <p>{selectedNode.description}</p>
                  ) : null}
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
                  <div className="popup-nav" aria-label="Step through path entities">
                    <button
                      type="button"
                      onClick={() => stepSelection(-1)}
                      disabled={selectedIndex <= 0}
                      title="Previous entity"
                      aria-label="Previous entity"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="popup-nav-count">
                      {selectedIndex + 1} / {graphData.nodes.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => stepSelection(1)}
                      disabled={selectedIndex >= graphData.nodes.length - 1}
                      title="Next entity"
                      aria-label="Next entity"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </aside>
              ) : null}
            </>
          ) : webglAvailable ? null : (
            <div className="webgl-fallback">
              3D rendering is unavailable. Reload to inspect this answer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
