import { useState, useEffect, useCallback, useRef } from "react";
import { Project } from "@/types/project";
import { projectService } from "@/services/projectService";

declare global {
  interface Window {
    Potree: any;
    viewer?: any;
    $: any;
    Cesium: any;
    cesiumViewer?: any;
    THREE?: any;
    toMap?: any;
  }
}

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

const injectedScripts = new Set<string>();
const viewerCache = new Map<string, any>();

interface UsePotreeViewerProps {
  jobNumber?: string | string[];
}

interface PotreeLoadEvent {
  pointcloud?: any;
  path?: string;
}

export function usePotreeViewer({ jobNumber }: UsePotreeViewerProps) {
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing viewer …");
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [viewerInstanceReady, setViewerInstanceReady] = useState(false);
  const isMounted = useRef(true);

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

  const initialise = useCallback(async () => {
    if (!jobNumber || Array.isArray(jobNumber)) return;

    setIsLoading(true);
    setLoadingMessage("Fetching project details …");
    setLoadingError(null);

    try {
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

      setLoadingMessage("Loading Potree libraries …");
      for (let i = 0; i < POTREE_SCRIPTS.length; i++) {
        await loadScript(POTREE_SCRIPTS[i]);
        if (!isMounted.current) return;
        setLoadingMessage(`Loaded ${i + 1}/${POTREE_SCRIPTS.length}`);
      }

      if (!window.Cesium) throw new Error("Cesium failed to load");

      if (viewerCache.has(jobNumber)) {
        window.viewer = viewerCache.get(jobNumber);
        setIsLoading(false);
        setViewerInstanceReady(true);
        return;
      }

      // Create container DOM
      let renderArea = document.getElementById("potree_render_area");
      let cesiumContainer: HTMLDivElement | null = null;

      if (!renderArea) {
        const potreeContainer = document.createElement("div");
        potreeContainer.className = "potree_container";
        Object.assign(potreeContainer.style, {
          position: "absolute",
          width: "100%",
          height: "100%",
          left: "0px",
          top: "0px",
        });

        renderArea = document.createElement("div");
        renderArea.id = "potree_render_area";
        Object.assign(renderArea.style, {
          position: "absolute",
          width: "100%",
          height: "100%",
          zIndex: "1",
        });

        cesiumContainer = document.createElement("div");
        cesiumContainer.id = "cesiumContainer";
        Object.assign(cesiumContainer.style, {
          position: "absolute",
          width: "100%",
          height: "100%",
          zIndex: "0",
        });

        renderArea.appendChild(cesiumContainer);

        const sidebar = document.createElement("div");
        sidebar.id = "potree_sidebar_container";

        potreeContainer.appendChild(renderArea);
        potreeContainer.appendChild(sidebar);

        document.body.appendChild(potreeContainer);
      } else {
        cesiumContainer = renderArea.querySelector<HTMLDivElement>("#cesiumContainer");
        if (!cesiumContainer) {
          cesiumContainer = document.createElement("div");
          cesiumContainer.id = "cesiumContainer";
          Object.assign(cesiumContainer.style, {
            position: "absolute",
            width: "100%",
            height: "100%",
            zIndex: "0",
          });
          renderArea.prepend(cesiumContainer);
        }
      }

      // Create Cesium viewer
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
          imageryProvider: window.Cesium.createOpenStreetMapImageryProvider({
            url: "https://a.tile.openstreetmap.org/",
          }),
          terrainShadows: window.Cesium.ShadowMode.DISABLED,
        });

        const cp = new window.Cesium.Cartesian3(4303414.154, 552161.235, 4660771.704);
        window.cesiumViewer.camera.setView({
          destination: cp,
          orientation: {
            heading: 10,
            pitch: -window.Cesium.Math.PI_OVER_TWO * 0.5,
            roll: 0.0,
          },
        });
      }

      const viewer = new window.Potree.Viewer(renderArea);
      window.viewer = viewer;
      viewerCache.set(jobNumber, viewer);

      viewer.setEDLEnabled(true);
      viewer.setFOV(60);
      viewer.setPointBudget(3_000_000);
      viewer.setDescription(currentProjectName);
      viewer.setLanguage("en");
      viewer.setLengthUnit("ft");
      viewer.setBackground(null);

      viewer.loadGUI(() => {
        const sidebar = document.getElementById("potree_sidebar_container");
        if (sidebar && window.$?.(sidebar).perfectScrollbar) {
          window.$(sidebar).perfectScrollbar();
        }
      });

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
        }
      );

      // Main animation loop
      function animationLoop(timestamp: number) {
        requestAnimationFrame(animationLoop);
        const Potree = window.Potree;
        const viewer = window.viewer;
        const Cesium = window.Cesium;
        const cesiumViewer = window.cesiumViewer;

        if (!Potree || !viewer || !Cesium || !cesiumViewer) return;

        const delta = viewer.clock.getDelta();
        viewer.update(delta, timestamp);
        viewer.render();
        cesiumViewer.render();
      }

      requestAnimationFrame(animationLoop);
    } catch (error) {
      if (!isMounted.current) return;
      console.error(error);
      setLoadingError((error as Error).message);
      setIsLoading(false);
    }
  }, [jobNumber, loadScript]);

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
  }, [initialise]);

  return {
    projectData,
    isLoading,
    loadingMessage,
    loadingError,
    viewerInstanceReady,
  };
}
