import { useState, useEffect, useCallback, useRef } from "react";
import { Project } from "@/types/project";
import { projectService } from "@/services/projectService";

// If you uncomment this line make sure the service exists in prod bundles!
// import { potreeLocationService } from "@/services/potreeLocationService";

/** -------------------------------------------------------------------
 * GLOBAL DECLARATIONS
 * ------------------------------------------------------------------*/
declare global {
  interface Window {
    Potree: any; // Potree bundles ship without TS types.
    viewer?: any;
    $: any;
    Cesium: any;
    cesiumViewer?: any;
  }
}

/** -------------------------------------------------------------------
 * CONSTANTS & SINGLETONS (shared across hook instances)
 * ------------------------------------------------------------------*/
const POTREE_SCRIPTS = [
  "/potree/libs/jquery/jquery-3.1.1.min.js",
  "/potree/libs/spectrum/spectrum.js",
  "/potree/libs/jquery-ui/jquery-ui.min.js",
  "/potree/libs/other/BinaryHeap.js",
  "/potree/libs/tween/tween.min.js",
  "/potree/libs/d3/d3.js",
  "/potree/libs/proj4/proj4.js",
  "/potree/libs/openlayers3/ol.js",
  "/potree/libs/i18next/i18next.js",
  "/potree/libs/jstree/jstree.js",
  "/potree/build/potree/potree.js",
  "/potree/libs/plasio/js/laslaz.js",
  "/potree/libs/Cesium/Cesium.js",
  "/potree/libs/perfect-scrollbar/js/perfect-scrollbar.jquery.js",
  "/potree/libs/amcharts/amcharts.js",
  "/potree/libs/amcharts/serial.js",
  "/potree/libs/panzoom/panzoom.min.js",
  "/potree/libs/papa/papaparse.js",
] as const;

/** Tracks scripts injected into <head>. */
const injectedScripts = new Set<string>();

/** Cache: jobNumber → Potree.Viewer for quick return when navigating. */
const viewerCache = new Map<string, any>();

/** -------------------------------------------------------------------
 * TYPES
 * ------------------------------------------------------------------*/
interface UsePotreeViewerProps {
  jobNumber?: string | string[];
}

interface PotreeLoadEvent {
  pointcloud?: any;
  path?: string;
}

/** -------------------------------------------------------------------
 * HOOK IMPLEMENTATION
 * ------------------------------------------------------------------*/
export function usePotreeViewer({ jobNumber }: UsePotreeViewerProps) {
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing viewer …");
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [viewerInstanceReady, setViewerInstanceReady] = useState(false);

  const isMounted = useRef(true);

  /** -------------------------------------------------------------
   * Helper: load an external script once.
   * ------------------------------------------------------------*/
  const loadScript = useCallback((src: string) => {
    return new Promise<void>((resolve, reject) => {
      if (injectedScripts.has(src)) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => {
        injectedScripts.add(src);
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load script ${src}`));
      document.head.appendChild(script);
    });
  }, []);

  /** -------------------------------------------------------------
   * Core initialisation, memoised by jobNumber.
   * ------------------------------------------------------------*/
  const initialise = useCallback(async () => {
    if (!jobNumber || Array.isArray(jobNumber)) return;

    /* --- UI state --- */
    setIsLoading(true);
    setLoadingMessage("Fetching project details …");
    setLoadingError(null);

    try {
      /* ---------------- Fetch meta data ---------------- */
      let fetchedProject: Project | null = null;
      let currentProjectName = `Project ${jobNumber}`;

      try {
        const mongo = await projectService.getProject(jobNumber);
        if (mongo) {
          fetchedProject = mongo;
          currentProjectName = mongo.projectName;
        }
      } catch (err) {
        console.warn("projectService failed", err);
      }

      if (!fetchedProject) {
        fetchedProject = {
          jobNumber,
          projectName: currentProjectName,
          clientName: "N/A",
          acquistionDate: new Date().toISOString(),
          description: "Point cloud data.",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          projectType: "survey",
        } as Project;
      }
      if (!isMounted.current) return;
      setProjectData(fetchedProject);

      /* ---------------- Load Potree + deps ---------------- */
      setLoadingMessage("Loading Potree libraries …");
      for (let i = 0; i < POTREE_SCRIPTS.length; i++) {
        await loadScript(POTREE_SCRIPTS[i]);
        if (!isMounted.current) return;
        setLoadingMessage(`Loaded ${i + 1}/${POTREE_SCRIPTS.length}`);
      }

      if (!window.Cesium) throw new Error("Cesium failed to load");

      /* ---------------- Re‑use cached viewer ---------------- */
      if (viewerCache.has(jobNumber)) {
        window.viewer = viewerCache.get(jobNumber);
        setIsLoading(false);
        setViewerInstanceReady(true);
        return;
      }

      /* ---------------- DOM prep ---------------- */
      let renderArea = document.getElementById("potree_render_area") as HTMLElement | null;

      if (!renderArea) {
        // If the host page didn't provide the Potree markup, build a minimal one.
        const potreeContainer = document.createElement("div");
        potreeContainer.className = "potree_container";
        Object.assign(potreeContainer.style, {
          position: "absolute",
          width: "100%",
          height: "100%",

        });

        renderArea = document.createElement("div");
        renderArea.id = "potree_render_area";
        Object.assign(renderArea.style, {
          width: "100%",
          height: "100%",
        });
        potreeContainer.appendChild(renderArea);

        const sidebar = document.createElement("div");
        sidebar.id = "potree_sidebar_container";
        potreeContainer.appendChild(sidebar);

        document.body.appendChild(potreeContainer);
      }

      const raElement = renderArea;
      if (getComputedStyle(raElement).position === "static") {
        raElement.style.position = "relative";
      }

      let cesiumContainer = raElement.querySelector<HTMLDivElement>("#cesiumContainer");
      if (!cesiumContainer) {
        cesiumContainer = document.createElement("div");
        cesiumContainer.id = "cesiumContainer";
        Object.assign(cesiumContainer.style, {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "Green",
        });
        raElement.prepend(cesiumContainer);
      }

      /* ---------------- Cesium viewer ---------------- */
      if (!window.cesiumViewer) {
        window.cesiumViewer = new window.Cesium.Viewer(cesiumContainer, {
          useDefaultRenderLoop: false,
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          imageryProvider: window.Cesium.createOpenStreetMapImageryProvider({ url: "https://a.tile.openstreetmap.org/" }),
          terrainShadows: window.Cesium.ShadowMode.DISABLED,
        });
      }

      const cesiumViewer = window.cesiumViewer;
    if (cesiumViewer) {
      let cp = new window.Cesium.Cartesian3(4303414.154026048, 552161.235598733, 4660771.704035539);
      cesiumViewer.camera.setView({
        destination: cp,
        orientation: {
          heading: 10,
          pitch: -window.Cesium.Math.PI_OVER_TWO * 0.5,
          roll: 0.0
        }
      });
    }


      /* ---------------- Potree viewer ---------------- */
      const viewer = new window.Potree.Viewer(raElement);
      window.viewer = viewer;
      viewerCache.set(jobNumber, viewer);

      viewer.setEDLEnabled(true);
      viewer.setFOV(60);
      viewer.setPointBudget(3_000_000);
      viewer.setDescription(currentProjectName);
      viewer.setLanguage("en");
      viewer.setLengthUnit("ft");

      viewer.loadGUI(() => {
        const sidebar = document.getElementById("potree_sidebar_container");
        if (sidebar && window.$?.(sidebar).perfectScrollbar) {
          window.$(sidebar).perfectScrollbar();
        }
      });

      /* ---------------- Load point cloud ---------------- */
      setLoadingMessage("Loading point cloud …");
      const cloudJsPath = `https://hwc-backend-server.vercel.app/pointclouds/${jobNumber}/cloud.js`;

      window.Potree.loadPointCloud(
        cloudJsPath,
        currentProjectName,
        (e: PotreeLoadEvent) => {
          if (!isMounted.current) return;
          if (e.pointcloud) {
            viewer.scene.addPointCloud(e.pointcloud);
            e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
            e.pointcloud.material.size = 1;
            viewer.fitToScreen(0.8);
            setIsLoading(false);
            setViewerInstanceReady(true);
          }
        },
        (err: unknown) => {
          if (!isMounted.current) return;
          const msg = typeof err === "string" ? err : (err as Error)?.message ?? "Unknown error";
          setLoadingError(`Failed to load point cloud: ${msg}`);
          setIsLoading(false);
        },
      );
    } catch (error) {
      if (!isMounted.current) return;
      console.error(error);
      setLoadingError((error as Error).message);
      setIsLoading(false);
    }
  }, [jobNumber, loadScript]);

  /** -------------------------------------------------------------
   * Lifecycle: init + cleanup.
   * ------------------------------------------------------------*/
  useEffect(() => {
    isMounted.current = true;
    initialise();

    return () => {
      isMounted.current = false;
      setViewerInstanceReady(false);
      setIsLoading(true);
      setLoadingMessage("Initializing viewer …");
      setLoadingError(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialise]);

  return {
    projectData,
    isLoading,
    loadingMessage,
    loadingError,
    viewerInstanceReady,
  };
}
