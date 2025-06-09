import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Menu, X, MapPin, Info } from "lucide-react";
import { Project } from "@/types/project";
import { potreeLocationService } from "@/services/potreeLocationService";
import { projectService } from "@/services/projectService";
import "@/styles/potree-viewer.css"; // Import the Potree viewer styles

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

export default function PotreeViewerPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing viewer...");
  const [loadingError, setLoadingError] = useState<string | null>(null);
  
  const [mapType, setMapType] = useState<"default" | "terrain" | "satellite" | "openstreet">("default");
  const [customSidebarVisible, setCustomSidebarVisible] = useState(true); 
  const [showProjectInfoPanel, setShowProjectInfoPanel] = useState(false);
  const [viewerInstanceReady, setViewerInstanceReady] = useState(false);

  const loadedScriptsRef = useRef<HTMLScriptElement[]>([]);

  const fetchProjectAndLoadViewer = useCallback(async () => {
    if (!jobNumber || typeof jobNumber !== "string") {
      setLoadingMessage("Waiting for project information...");
      return;
    }

    let isMounted = true; // This variable will be local to each call of fetchProjectAndLoadViewer
    // We need a way to make sure cleanup uses the correct isMounted if the effect re-runs.
    // However, the main useEffect cleanup will handle the global sense of mounting.

    const scriptsCurrentlyLoaded: HTMLScriptElement[] = [];

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
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
          if (isMounted) {
            console.log(`Loaded script: ${src}`);
            scriptsCurrentlyLoaded.push(script);
            resolve();
          }
        };
        script.onerror = () => {
          if (isMounted) {
            console.error(`Failed to load script ${src}`);
            reject(new Error(`Failed to load script ${src}`));
          }
        };
        document.head.appendChild(script);
      });
    };

    const fetchProjectAndLoadViewer = async () => {
      try {
        if (!isMounted) return;
        setLoadingMessage("Fetching project details...");
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
        
        if (isMounted) {
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
        }

        if (!isMounted) return;
        setLoadingMessage("Loading Potree libraries...");
        for (let i = 0; i < POTREE_SCRIPTS.length; i++) {
          if (!isMounted) return;
          const scriptName = POTREE_SCRIPTS[i].split('/').pop() || POTREE_SCRIPTS[i];
          setLoadingMessage(`Loading library ${i + 1}/${POTREE_SCRIPTS.length}: ${scriptName}`);
          await loadScript(POTREE_SCRIPTS[i]);
        }
        loadedScriptsRef.current = scriptsCurrentlyLoaded;

        if (!isMounted || !window.Potree || !window.Potree.Viewer) {
          throw new Error("Potree library did not load correctly.");
        }

        if (!isMounted) return;
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
        window.viewer = viewer;

        viewer.setEDLEnabled(true);
        viewer.setFOV(60);
        viewer.setPointBudget(3 * 1000 * 1000);
        viewer.setDescription(currentProjectName);
        viewer.setLanguage("en");

        viewer.loadGUI(() => {
            if (isMounted) {
                console.log("Potree GUI loaded.");
                if (window.$ && potreeSidebarElement && typeof window.$(potreeSidebarElement).perfectScrollbar === "function") {
                    window.$(potreeSidebarElement).perfectScrollbar();
                }
            }
        });

        if (!isMounted) return;
        setLoadingMessage("Loading point cloud...");
        // Update paths to prioritize cloud.js
        const cloudJsPath = `/pointclouds/${jobNumber}/cloud.js`;
        const metadataPath = `/pointclouds/${jobNumber}/metadata.json`;
        const exampleCloudJsPath = "/pointclouds/example/cloud.js"; // Assuming example might also have cloud.js
        const exampleMetadataPath = "/pointclouds/example/metadata.json";

        const loadCallback = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!isMounted) return;
          if (e.pointcloud) {
            viewer.scene.addPointCloud(e.pointcloud);
            e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
            e.pointcloud.material.size = 1;
            viewer.fitToScreen(0.8); 
            setLoadingMessage("Point cloud loaded.");
            setIsLoading(false);
            setViewerInstanceReady(true);
          } else {
            // This block might be reached if the load was technically successful but no pointcloud object was in the event
            // Or if Potree internally decided not to proceed after a certain stage.
            // The error callback is more reliable for actual load failures.
            console.warn("Load callback invoked but no pointcloud in event, or Potree internal issue. Event:", e);
            // Attempting next fallback if not already on the last one.
            // This logic is tricky here, better handled by the error callback chain.
            // For now, we rely on the error callback to try next. If this is reached without error, it's an ambiguous state.
            if (e.path !== exampleMetadataPath && e.path !== exampleCloudJsPath) {
                 setLoadingMessage("Problem loading primary cloud, trying next fallback...");
                 // This manual retry here might conflict with the error callback's retry.
                 // It's safer to let the error callback handle retries.
            } else if (!loadingError) { // Only set error if not already set by error callback // loadingError is used here
                setLoadingError("Failed to load point cloud and example fallback (ambiguous success).");
                setIsLoading(false);
            }
          }
        };
        
        const loadErrorCallback = (errorEvent: any, attemptedPath: string, nextAttemptFn?: () => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!isMounted) return;
            console.error(`Error loading point cloud from ${attemptedPath}:`, errorEvent);
            if (nextAttemptFn) {
                setLoadingMessage(`Failed: ${attemptedPath.split('/').pop()}. Trying next...`);
                nextAttemptFn();
            } else {
                setLoadingError(`Failed to load point cloud: ${errorEvent.message || "Unknown error"} after all fallbacks.`);
                setIsLoading(false);
            }
        };

        const tryLoadExampleMetadata = () => {
            setLoadingMessage("Trying example metadata.json...");
            window.Potree.loadPointCloud(exampleMetadataPath, "Example Cloud (metadata)", loadCallback, (err: any) => loadErrorCallback(err, exampleMetadataPath)); // eslint-disable-line @typescript-eslint/no-explicit-any
        };
        
        const tryLoadExampleCloudJs = () => {
            setLoadingMessage("Trying example cloud.js...");
            window.Potree.loadPointCloud(exampleCloudJsPath, "Example Cloud (cloud.js)", loadCallback, (err: any) => loadErrorCallback(err, exampleCloudJsPath, tryLoadExampleMetadata)); // eslint-disable-line @typescript-eslint/no-explicit-any
        };

        const tryLoadProjectMetadata = () => {
            setLoadingMessage(`Trying ${currentProjectName} metadata.json...`);
            window.Potree.loadPointCloud(metadataPath, currentProjectName, loadCallback, (err: any) => loadErrorCallback(err, metadataPath, tryLoadExampleCloudJs)); // eslint-disable-line @typescript-eslint/no-explicit-any
        };

        // Start loading sequence
        setLoadingMessage(`Trying ${currentProjectName} cloud.js...`);
        window.Potree.loadPointCloud(cloudJsPath, currentProjectName, loadCallback, (err: any) => loadErrorCallback(err, cloudJsPath, tryLoadProjectMetadata)); // eslint-disable-line @typescript-eslint/no-explicit-any

      } catch (err) {
        // No need to check isMounted here as this is within the async function's scope
        console.error("Error during viewer initialization:", err);
        setLoadingError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    };

    fetchProjectAndLoadViewer();

    return () => {
      isMounted = false;
      console.log("Cleaning up Potree viewer and scripts...");
      if (window.viewer) {
        try {
            if (window.viewer.scene && window.viewer.scene.pointclouds) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                window.viewer.scene.pointclouds.forEach((pc: any) => window.viewer.scene.removePointCloud(pc));
            }
            const renderArea = document.getElementById("potree_render_area");
            if (renderArea) renderArea.innerHTML = ""; 
            const sidebarArea = document.getElementById("potree_sidebar_container");
            if(sidebarArea) sidebarArea.innerHTML = "";
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
    };
  }, [jobNumber, setProjectData, setLoadingMessage, setLoadingError, setIsLoading, setViewerInstanceReady, loadingError]);

  useEffect(() => {
    // let isMountedGlobal = true; // This variable is not strictly necessary for the cleanup logic here.

    if (jobNumber) {
      fetchProjectAndLoadViewer();
    }

    return () => {
      // isMountedGlobal = false; // No longer needed
      
      console.log("Cleaning up Potree viewer and scripts from main useEffect...");
      if (window.viewer) {
        try {
            if (window.viewer.scene && window.viewer.scene.pointclouds) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                window.viewer.scene.pointclouds.forEach((pc: any) => window.viewer.scene.removePointCloud(pc));
            }
            const renderArea = document.getElementById("potree_render_area");
            if (renderArea) renderArea.innerHTML = ""; 
            const sidebarArea = document.getElementById("potree_sidebar_container");
            if(sidebarArea) sidebarArea.innerHTML = "";
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
    };
  }, [jobNumber, fetchProjectAndLoadViewer]);

  const toggleCustomSidebar = () => {
    setCustomSidebarVisible(prev => !prev);
    const sidebarEl = document.getElementById("potree_sidebar_container");
    if (sidebarEl) {
        sidebarEl.style.display = !customSidebarVisible ? "block" : "none";
    }
  };

  const handleMapTypeChange = (newMapType: "default" | "terrain" | "satellite" | "openstreet") => {
    setMapType(newMapType);
    if (window.viewer && window.viewer.mapView && typeof window.viewer.mapView.setMapType === 'function') {
      try {
        window.viewer.mapView.setMapType(newMapType);
        console.log("Map type set to:", newMapType);
      } catch (error) {
        console.log("Could not change map type:", error);
      }
    }
  };

  return (
    <>
      <Head>
        <title>{projectData?.projectName || (jobNumber ? `Project ${jobNumber}` : "Potree Viewer")} - HWC Engineering</title>
        <meta name="description" content="HWC Engineering Point Cloud Viewer" />
        <link rel="icon" href="/hwc-angle-logo-16px-mbe1odp0.png" />
        <link rel="stylesheet" type="text/css" href="/potree/build/potree/potree.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/openlayers3/ol.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/spectrum/spectrum.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jstree/themes/mixed/style.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/Cesium/Widgets/CesiumWidget/CesiumWidget.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css" />
      </Head>

      {/* Potree containers - always rendered */}
      <div className="potree_outer_container">
        <div id="potree_render_area" />
        <div id="potree_sidebar_container" style={{ display: customSidebarVisible ? 'block' : 'none' }} />
      </div>

      {isLoading && (
        <div className="viewer-overlay">
          <div className="text-center">
            <Image
              src="/hwc-logo-4c-mbe1obbx.png"
              alt="HWC Engineering"
              width={200}
              height={67}
              priority
              className="mx-auto mb-4"
              style={{ width: "auto", height: "auto" }}
            />
            <h1 className="text-2xl font-semibold mb-2">
              {projectData?.projectName || (jobNumber ? `Project ${jobNumber}`: "Loading Project...")}
            </h1>
            <div className="w-80 mx-auto">
              <div className="bg-hwc-gray rounded-full h-2 mb-4">
                {/* Using loadingMessage for progress text instead of percentage */}
              </div>
              <p className="text-hwc-light">{loadingMessage}</p>
            </div>
            <div className="mt-8 text-sm text-hwc-light">
              Powered by HWC Engineering
            </div>
          </div>
        </div>
      )}

      {loadingError && (
         <div className="viewer-overlay">
          <div className="text-center">
            <Image
              src="/hwc-logo-4c-mbe1obbx.png"
              alt="HWC Engineering"
              width={200}
              height={67}
              priority
              className="mx-auto mb-8"
              style={{ width: "auto", height: "auto" }}
            />
            <h1 className="text-2xl font-bold mb-4">Error Loading Viewer</h1>
            <p className="mb-6 text-hwc-light">{loadingError}</p>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  console.log("Attempting reload due to error.");
                  setLoadingError(null);
                  setIsLoading(true);
                  setLoadingMessage("Retrying initialization...");
                  setViewerInstanceReady(false);
                  // Full reload might be necessary if state is complex or scripts are problematic
                  window.location.reload(); 
                }}
                className="bg-hwc-red hover:bg-hwc-red/90 mr-3"
              >
                Try Again
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="border-hwc-red text-hwc-red hover:bg-hwc-red hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewerInstanceReady && !isLoading && !loadingError && (
        <>
          {/* Custom Header */}
          <div className="absolute top-0 left-0 right-0 z-50 bg-hwc-dark/95 backdrop-blur-md text-white border-b border-hwc-red/20">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/")}
                  className="text-white hover:bg-hwc-red/20 font-medium"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                <div className="h-6 w-px bg-hwc-gray/50"></div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {projectData?.projectName || `Project ${jobNumber}`}
                </h1>
                {projectData?.location && (
                  <div className="flex items-center gap-2 text-sm text-hwc-light/80">
                    <MapPin className="h-3 w-3" />
                    <span className="font-mono">
                      {projectData.location.latitude.toFixed(4)}, {projectData.location.longitude.toFixed(4)}
                      {projectData.location.source && (
                        <span className="ml-2 text-xs opacity-60 bg-hwc-gray/20 px-2 py-1 rounded">
                          {projectData.location.source}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProjectInfoPanel(!showProjectInfoPanel)}
                  className="text-white hover:bg-hwc-red/20"
                  title="Project Information"
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleCustomSidebar}
                  className="text-white hover:bg-hwc-red/20"
                  title={customSidebarVisible ? "Hide Potree Sidebar" : "Show Potree Sidebar"}
                >
                  {customSidebarVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                <a 
                  href="https://www.hwcengineering.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="cursor-pointer"
                >
                  <Image
                    src="/hwc-logo-4c-mbe1obbx.png"
                    alt="HWC Engineering"
                    width={100}
                    height={34}
                    priority
                    className="h-8 hover:opacity-80 transition-opacity"
                    style={{ width: "auto", height: "auto" }}
                  />
                </a>
              </div>
            </div>
          </div>

          {/* Project Info Panel */}
          {showProjectInfoPanel && projectData && (
            <div className="absolute top-20 right-6 z-40 w-96">
              <Card className="bg-hwc-dark/95 backdrop-blur-md border border-hwc-red/20 text-white">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 text-lg">Project Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-hwc-light">Job Number:</span>
                      <span className="font-mono">{projectData.jobNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-hwc-light">Project Name:</span>
                      <span className="font-medium">{projectData.projectName}</span>
                    </div>
                    {projectData.clientName && (
                      <div className="flex justify-between">
                        <span className="text-hwc-light">Client:</span>
                        <span>{projectData.clientName}</span>
                      </div>
                    )}
                    {projectData.description && (
                      <div>
                        <span className="text-hwc-light">Description:</span>
                        <p className="mt-1 text-xs leading-relaxed">{projectData.description}</p>
                      </div>
                    )}
                    {projectData.location && (
                      <div>
                        <span className="text-hwc-light">Location:</span>
                        <div className="mt-1 text-xs font-mono space-y-1">
                          <div>Lat: {projectData.location.latitude.toFixed(6)}</div>
                          <div>Lon: {projectData.location.longitude.toFixed(6)}</div>
                          {projectData.location.source && (
                            <div className="text-hwc-light/60">
                              Source: {projectData.location.source} 
                              {projectData.location.confidence && ` (${projectData.location.confidence})`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {projectData.crs && (
                      <div>
                        <span className="text-hwc-light">Coordinate System:</span>
                        <div className="mt-1 text-xs space-y-1">
                          <div>Horizontal: <span className="font-mono">{projectData.crs.horizontal}</span></div>
                          {projectData.crs.vertical && <div>Vertical: <span className="font-mono">{projectData.crs.vertical}</span></div>}
                          {projectData.crs.geoidModel && <div>Geoid: <span className="font-mono">{projectData.crs.geoidModel}</span></div>}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Map Type Controls */}
          <div className="absolute top-20 left-6 z-40">
            <Card className="bg-hwc-dark/95 backdrop-blur-md border border-hwc-red/20">
              <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {(["default", "terrain", "satellite", "openstreet"] as const).map((type) => (
                    <Button
                      key={type}
                      variant={mapType === type ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleMapTypeChange(type)}
                      className={`text-xs h-9 ${mapType === type ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
