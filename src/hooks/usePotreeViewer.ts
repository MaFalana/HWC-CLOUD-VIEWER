import { useState, useEffect, useCallback, useRef } from "react";
import { Project } from "@/types/project";
import { projectService } from "@/services/projectService";
import { potreeLocationService } from "@/services/potreeLocationService";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Potree: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    viewer: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $: any;
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
  "/potree/libs/papa/papaparse.js"
];

interface UsePotreeViewerProps {
  jobNumber: string | string[] | undefined;
}

export function usePotreeViewer({ jobNumber }: UsePotreeViewerProps) {
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing viewer...");
  const [loadingError, setLoadingError] = useState<string | null>(null);
  
  const [viewerInstanceReady, setViewerInstanceReady] = useState(false);
  const loadedScriptsRef = useRef<HTMLScriptElement[]>([]);
  const isMountedRef = useRef(true); // To track mount status for async operations

  const initializeViewerLogic = useCallback(async () => {
    if (!jobNumber || typeof jobNumber !== "string") {
      setLoadingMessage("Waiting for project information...");
      setIsLoading(true); // Ensure loading state is true
      return;
    }
    
    isMountedRef.current = true;
    setIsLoading(true);
    setLoadingError(null);
    setLoadingMessage("Fetching project details...");

    const scriptsCurrentlyLoaded: HTMLScriptElement[] = [];

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!isMountedRef.current) {
          reject(new Error("Component unmounted during script load"));
          return;
        }
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
          console.log(`Script already in DOM: ${src}`);
          if (!scriptsCurrentlyLoaded.find(s => s.src === (existingScript as HTMLScriptElement).src)) {
            scriptsCurrentlyLoaded.push(existingScript as HTMLScriptElement);
          }
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.onload = () => {
          if (isMountedRef.current) {
            console.log(`Loaded script: ${src}`);
            scriptsCurrentlyLoaded.push(script);
            resolve();
          } else {
            reject(new Error("Component unmounted after script load"));
          }
        };
        script.onerror = () => {
          if (isMountedRef.current) {
            console.error(`Failed to load script ${src}`);
            reject(new Error(`Failed to load script ${src}`));
          }
        };
        document.head.appendChild(script);
      });
    };

    try {
      let currentProjectName = `Project ${jobNumber}`;
      let fetchedProject: Project | null = null;

      try {
        const mongoData = await projectService.getProject(jobNumber);
        if (mongoData) {
          fetchedProject = mongoData;
          currentProjectName = mongoData.projectName;
        }
      } catch (e) {
        console.warn("Could not fetch full project details from projectService, trying Potree location service:", e);
        try {
          const potreeInfo = await potreeLocationService.getProjectInfo(jobNumber);
          if (potreeInfo && potreeInfo.projectName) {
            currentProjectName = potreeInfo.projectName;
            fetchedProject = {
              ...potreeInfo,
              jobNumber: jobNumber,
              projectName: currentProjectName,
              clientName: potreeInfo.clientName || "N/A",
              acquistionDate: potreeInfo.acquistionDate || new Date().toISOString(),
              description: potreeInfo.description || "Point cloud data.",
              status: potreeInfo.status || "active",
              createdAt: potreeInfo.createdAt || new Date(),
              updatedAt: potreeInfo.updatedAt || new Date(),
              projectType: potreeInfo.projectType || "survey",
            } as Project;
          }
        } catch (e2) {
          console.warn("Could not fetch project info from Potree location service either:", e2);
        }
      }
      
      if (!isMountedRef.current) return;
      if (fetchedProject) {
        setProjectData(fetchedProject);
      } else {
        const fallbackProject: Project = {
          jobNumber: jobNumber, projectName: currentProjectName, clientName: "N/A",
          acquistionDate: new Date().toISOString(), description: "Point cloud data.",
          status: "active", createdAt: new Date(), updatedAt: new Date(), projectType: "survey",
        };
        setProjectData(fallbackProject);
      }

      if (!isMountedRef.current) return;
      setLoadingMessage("Loading Potree libraries...");
      for (let i = 0; i < POTREE_SCRIPTS.length; i++) {
        if (!isMountedRef.current) return;
        const scriptName = POTREE_SCRIPTS[i].split('/').pop() || POTREE_SCRIPTS[i];
        setLoadingMessage(`Loading library ${i + 1}/${POTREE_SCRIPTS.length}: ${scriptName}`);
        await loadScript(POTREE_SCRIPTS[i]);
      }
      loadedScriptsRef.current = scriptsCurrentlyLoaded;

      if (!isMountedRef.current || !window.Potree || !window.Potree.Viewer) {
        throw new Error("Potree library did not load correctly.");
      }

      if (!isMountedRef.current) return;
      setLoadingMessage("Initializing Potree viewer...");
      const potreeRenderElement = document.getElementById("potree_render_area");
      const potreeSidebarElement = document.getElementById("potree_sidebar_container");

      if (!potreeRenderElement) {
        throw new Error("Potree render area DOM element (#potree_render_area) not found.");
      }
      if (!potreeSidebarElement) {
        console.warn("Potree sidebar container DOM element (#potree_sidebar_container) not found. GUI might not attach as expected.");
      }

      const viewer = new window.Potree.Viewer(potreeRenderElement);
      window.viewer = viewer; // Make it globally accessible

      viewer.setEDLEnabled(true);
      viewer.setFOV(60);
      viewer.setPointBudget(3 * 1000 * 1000);
      viewer.setDescription(currentProjectName);
      viewer.setLanguage("en");

      viewer.loadGUI(() => {
        if (isMountedRef.current) {
          console.log("Potree GUI loaded.");
          if (window.$ && potreeSidebarElement && typeof window.$(potreeSidebarElement).perfectScrollbar === "function") {
            window.$(potreeSidebarElement).perfectScrollbar();
          }
        }
      });

      if (!isMountedRef.current) return;
      setLoadingMessage("Loading point cloud...");
      const cloudJsPath = `https://hwc-backend-server.vercel.app/pointclouds/${jobNumber}/cloud.js`;
      const metadataPath = `https://hwc-backend-server.vercel.app/pointclouds/${jobNumber}/metadata.json`;
      const exampleCloudJsPath = "/pointclouds/example/cloud.js";
      const exampleMetadataPath = "/pointclouds/example/metadata.json";

      const loadCallback = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!isMountedRef.current) return;
        if (e.pointcloud) {
          viewer.scene.addPointCloud(e.pointcloud);
          e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
          e.pointcloud.material.size = 1;
          viewer.fitToScreen(0.8);
          setLoadingMessage("Point cloud loaded.");
          setIsLoading(false);
          setViewerInstanceReady(true);
        } else {
          console.warn("Load callback invoked but no pointcloud in event, or Potree internal issue. Event:", e);
          if (e.path !== exampleMetadataPath && e.path !== exampleCloudJsPath) {
            // This means a primary load attempt might have had an issue not caught by error callback
            // Or it's an intermediate event. Rely on error callback for retries.
          } else if (!loadingError) {
            setLoadingError("Failed to load point cloud and example fallback (ambiguous success).");
            setIsLoading(false);
          }
        }
      };
      
      const loadErrorCallback = (errorEvent: any, attemptedPath: string, nextAttemptFn?: () => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!isMountedRef.current) return;
        console.error(`Error loading point cloud from ${attemptedPath}:`, errorEvent);
        if (nextAttemptFn) {
          setLoadingMessage(`Failed: ${attemptedPath.split('/').pop()}. Trying next...`);
          nextAttemptFn();
        } else {
          setLoadingError(`Failed to load point cloud: ${errorEvent?.message || "Unknown error"} after all fallbacks.`);
          setIsLoading(false);
        }
      };

      const tryLoadExampleMetadata = () => {
        if (!isMountedRef.current) return;
        setLoadingMessage("Trying example metadata.json...");
        window.Potree.loadPointCloud(exampleMetadataPath, "Example Cloud (metadata)", loadCallback, (err: any) => loadErrorCallback(err, exampleMetadataPath)); // eslint-disable-line @typescript-eslint/no-explicit-any
      };
      
      const tryLoadExampleCloudJs = () => {
        if (!isMountedRef.current) return;
        setLoadingMessage("Trying example cloud.js...");
        window.Potree.loadPointCloud(exampleCloudJsPath, "Example Cloud (cloud.js)", loadCallback, (err: any) => loadErrorCallback(err, exampleCloudJsPath, tryLoadExampleMetadata)); // eslint-disable-line @typescript-eslint/no-explicit-any
      };

      const tryLoadProjectMetadata = () => {
        if (!isMountedRef.current) return;
        setLoadingMessage(`Trying ${currentProjectName} metadata.json...`);
        window.Potree.loadPointCloud(metadataPath, currentProjectName, loadCallback, (err: any) => loadErrorCallback(err, metadataPath, tryLoadExampleCloudJs)); // eslint-disable-line @typescript-eslint/no-explicit-any
      };

      // Start loading sequence: cloud.js first, then metadata.json, then example cloud.js, then example metadata.json
      if (!isMountedRef.current) return;
      setLoadingMessage(`Trying ${currentProjectName} cloud.js...`);
      window.Potree.loadPointCloud(cloudJsPath, currentProjectName, loadCallback, (err: any) => loadErrorCallback(err, cloudJsPath, tryLoadProjectMetadata)); // eslint-disable-line @typescript-eslint/no-explicit-any

    } catch (err) {
      if (isMountedRef.current) {
        console.error("Error during viewer initialization:", err);
        setLoadingError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    }
  }, [jobNumber, loadingError]); // Added loadingError to dependencies as it's checked in loadCallback

  useEffect(() => {
    isMountedRef.current = true;
    if (jobNumber) {
      initializeViewerLogic();
    }

    return () => {
      isMountedRef.current = false;
      console.log("Cleaning up Potree viewer and scripts from usePotreeViewer hook...");
      if (window.viewer) {
        try {
          if (window.viewer.scene && window.viewer.scene.pointclouds) {
            window.viewer.scene.pointclouds.forEach((pc: any) => window.viewer.scene.removePointCloud(pc)); // eslint-disable-line @typescript-eslint/no-explicit-any
          }
          const renderArea = document.getElementById("potree_render_area");
          if (renderArea) renderArea.innerHTML = "";
          const sidebarArea = document.getElementById("potree_sidebar_container");
          if (sidebarArea) sidebarArea.innerHTML = "";
        } catch (e) {
          console.error("Error during Potree viewer cleanup:", e);
        }
        window.viewer = undefined;
      }
      loadedScriptsRef.current.forEach(script => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
          console.log(`Removed script: ${script.src}`);
        }
      });
      loadedScriptsRef.current = [];
      // Reset states on unmount or jobNumber change
      setProjectData(null);
      setIsLoading(true);
      setLoadingMessage("Initializing viewer...");
      setLoadingError(null);
      setViewerInstanceReady(false);
    };
  }, [jobNumber, initializeViewerLogic]);

  return {
    projectData,
    isLoading,
    loadingMessage,
    loadingError,
    viewerInstanceReady,
    retryLoad: initializeViewerLogic, // Expose a retry function
  };
}
