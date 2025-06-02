import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Menu, X, MapPin, Info } from "lucide-react";
import { Project } from "@/types/project";
import { potreeLocationService } from "@/services/potreeLocationService";

// Define types for Potree
interface PointCloudMaterial {
  pointSizeType: number;
}

interface PointCloud {
  material: PointCloudMaterial;
}

interface PotreeViewer {
  setEDLEnabled: (enabled: boolean) => void;
  setFOV: (fov: number) => void;
  setPointBudget: (budget: number) => void;
  setDescription: (description: string) => void;
  loadGUI: (callback: () => void) => void;
  setLanguage: (lang: string) => void;
  toggleSidebar: () => void;
  scene: {
    addPointCloud: (pointcloud: PointCloud) => void;
  };
  fitToScreen: (padding?: number) => void;
  mapView?: {
    setCenter: (coordinates: [number, number]) => void;
    setZoom: (zoom: number) => void;
    setMapType: (type: string) => void;
  };
  destroy?: () => void;
}

interface PotreeLoadEvent {
  pointcloud: PointCloud;
}

interface PotreeStatic {
  Viewer: new (element: HTMLElement) => PotreeViewer;
  PointSizeType: {
    ADAPTIVE: number;
  };
  loadPointCloud: (path: string, name: string, callback: (e: PotreeLoadEvent) => void) => void;
}

// Extend Window interface to include Potree
declare global {
  interface Window {
    Potree: PotreeStatic;
    potreeViewer?: PotreeViewer;
  }
}

export default function PotreeViewer() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mapType, setMapType] = useState<"default" | "terrain" | "satellite" | "openstreet">("default");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [showProjectInfo, setShowProjectInfo] = useState(false);

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string") return;

    const scriptsLoaded: HTMLScriptElement[] = [];

    const fetchProjectAndLoad = async () => {
      try {
        console.log("Starting Potree initialization...");
        
        // First, try to get project data from Potree metadata
        setLoadingProgress(10);
        const potreeProjectData = await potreeLocationService.getProjectInfo(jobNumber);
        
        let projectData: Partial<Project> = {
          jobNumber: jobNumber as string,
          projectName: `Project ${jobNumber}`,
          clientName: "Demo Client",
          acquistionDate: new Date().toISOString(),
          description: "Demo project for testing Potree viewer",
          status: "active" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          projectType: "survey",
          location: {
            latitude: 39.7684,
            longitude: -86.1581,
            address: "Indianapolis, IN",
            source: "fallback" as const,
            confidence: "low" as const
          }
        };

        // Merge Potree data if available
        if (potreeProjectData) {
          projectData = { ...projectData, ...potreeProjectData };
          console.log("Using Potree project data:", projectData);
        }

        setProject(projectData as Project);
        setProjectName(projectData.projectName || "");
        setLoadingProgress(15);

        // Try to fetch project info from API
        try {
          const res = await fetch(`http://localhost:4400/pointclouds/${jobNumber}/info.json`);
          if (res.ok) {
            const data = await res.json();
            console.log("Project data:", data);
            setProjectName(data.projectName);
            projectData = { ...projectData, ...data };
            setProject(projectData as Project);
          }
        } catch (error) {
          console.log("No project info found, using extracted data", error);
        }

        const loadScript = (src: string): Promise<void> =>
          new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
              resolve();
              return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.onload = () => {
              scriptsLoaded.push(script);
              resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load script ${src}`));
            document.body.appendChild(script);
          });

        console.log("Loading scripts...");
        setLoadingProgress(20);

        const scripts = [
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

        for (let i = 0; i < scripts.length; i++) {
          await loadScript(scripts[i]);
          setLoadingProgress(20 + Math.floor((i / scripts.length) * 60));
        }

        // Wait for Potree to be available
        if (!window.Potree) {
          throw new Error("Potree not available after loading scripts");
        }

        setLoadingProgress(85);

        const base = "http://localhost:4400/pointclouds/";
        const cloudJsPath = `${base}${jobNumber}/cloud.js`;
        const metadataPath = `${base}${jobNumber}/metadata.json`;
        const sourcesJsonPath = `${base}${jobNumber}/sources.json`;

        // Check which files exist
        let pathToLoad = null;
        
        try {
          const response = await fetch(cloudJsPath, { method: "HEAD" });
          if (response.ok) {
            pathToLoad = cloudJsPath;
            console.log("Using cloud.js for point cloud loading");
          }
        } catch (error) {
          console.log("No cloud.js found");
        }

        if (!pathToLoad) {
          try {
            const response = await fetch(metadataPath, { method: "HEAD" });
            if (response.ok) {
              pathToLoad = metadataPath;
              console.log("Using metadata.json for point cloud loading");
            }
          } catch (error) {
            console.log("No metadata.json found");
          }
        }

        if (!pathToLoad) {
          try {
            const response = await fetch(sourcesJsonPath, { method: "HEAD" });
            if (response.ok) {
              // For sources.json, use example metadata.json as fallback
              pathToLoad = "/pointclouds/example/metadata.json";
              console.log("Using example metadata.json for point cloud loading (sources.json found)");
            }
          } catch (error) {
            console.log("No sources.json found");
          }
        }

        if (!pathToLoad) {
          // If none exists, use example metadata.json
          pathToLoad = "/pointclouds/example/metadata.json";
          console.log("Using example metadata.json for point cloud loading (no files found)");
        }

        const viewer = new window.Potree.Viewer(document.getElementById("potree_render_area"));
        window.potreeViewer = viewer;
        
        viewer.setEDLEnabled(true);
        viewer.setFOV(60);
        viewer.setPointBudget(1_000_000);
        viewer.setDescription(projectData.projectName || "");
        
        viewer.loadGUI(() => {
          viewer.setLanguage("en");
          console.log("Potree GUI loaded");
        });

        const loadCallback = (e: PotreeLoadEvent) => {
          if (e.pointcloud) {
            console.log("Point cloud loaded successfully");
            viewer.scene.addPointCloud(e.pointcloud);
            e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
            viewer.fitToScreen(0.5);
            
            // If project has location data, position the map view accordingly
            if (projectData.location?.latitude && projectData.location?.longitude) {
              try {
                const mapView = viewer.mapView;
                if (mapView && typeof mapView.setCenter === "function") {
                  mapView.setCenter([projectData.location.longitude, projectData.location.latitude]);
                  if (typeof mapView.setZoom === "function") {
                    mapView.setZoom(15);
                  }
                  if (typeof mapView.setMapType === "function" && mapType !== "default") {
                    mapView.setMapType(mapType);
                  }
                  console.log(`Map positioned at: ${projectData.location.latitude}, ${projectData.location.longitude} (source: ${projectData.location.source})`);
                }
              } catch (mapError) {
                console.error("Failed to set map location:", mapError);
              }
            }
            
            setLoadingProgress(100);
            setTimeout(() => {
              setLoading(false);
            }, 500);
          } else {
            console.error("Failed to load point cloud");
            setLoadingProgress(100);
            setTimeout(() => {
              setLoading(false);
            }, 500);
          }
        };

        if (pathToLoad.endsWith("cloud.js")) {
          window.Potree.loadPointCloud(pathToLoad, "PointCloud", loadCallback);
        } else {
          window.Potree.loadPointCloud(pathToLoad, jobNumber as string, loadCallback);
        }

      } catch (err) {
        console.error("Error loading viewer:", err);
        setError(`Failed to initialize point cloud viewer: ${err instanceof Error ? err.message : "Unknown error"}`);
        setLoading(false);
      }
    };

    fetchProjectAndLoad();

    // Cleanup function
    return () => {
      scriptsLoaded.forEach((script) => {
        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
    };
  }, [jobNumber]);

  // Effect to update map type when it changes
  useEffect(() => {
    if (!loading && project && window.potreeViewer) {
      try {
        const viewer = window.potreeViewer;
        if (viewer.mapView && typeof viewer.mapView.setMapType === "function") {
          viewer.mapView.setMapType(mapType);
        }
      } catch (error) {
        console.log("Error updating map type:", error);
      }
    }
  }, [mapType, loading, project]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hwc-dark">
        <div className="text-center text-white">
          <div className="mb-8">
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
              {projectName || project?.projectName || `Project ${jobNumber}`}
            </h1>
          </div>
          
          <div className="w-80 mx-auto">
            <div className="bg-hwc-gray rounded-full h-2 mb-4">
              <div 
                className="bg-hwc-red h-2 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <p className="text-hwc-light">Loading {loadingProgress}%</p>
          </div>
          
          <div className="mt-8 text-sm text-hwc-light">
            Powered by HWC Engineering
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hwc-dark">
        <div className="text-center text-white">
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
          <p className="mb-6 text-hwc-light">{error}</p>
          <Button
            onClick={() => router.push("/")}
            className="bg-hwc-red hover:bg-hwc-red/90"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{projectName || project?.projectName || `Project ${jobNumber}`} - HWC Engineering Cloud Viewer</title>
        <meta name="description" content="Point cloud viewer" />
        <link rel="icon" href="/HWC-angle-logo-16px.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        
        {/* Potree CSS */}
        <link rel="stylesheet" href="/potree/build/potree/potree.css" />
        <link rel="stylesheet" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/openlayers3/ol.css"/>
        <link rel="stylesheet" type="text/css" href="/potree/libs/spectrum/spectrum.css"/>
        <link rel="stylesheet" type="text/css" href="/potree/libs/jstree/themes/mixed/style.css"/>
        <link rel="stylesheet" type="text/css" href="/potree/libs/Cesium/Widgets/CesiumWidget/CesiumWidget.css"/>
        <link rel="stylesheet" type="text/css" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css"/>
      </Head>

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
              {projectName || project?.projectName || `Project ${jobNumber}`}
            </h1>
            {project?.location && (
              <div className="flex items-center gap-2 text-sm text-hwc-light/80">
                <MapPin className="h-3 w-3" />
                <span className="font-mono">
                  {project.location.latitude.toFixed(4)}, {project.location.longitude.toFixed(4)}
                  {project.location.source && (
                    <span className="ml-2 text-xs opacity-60 bg-hwc-gray/20 px-2 py-1 rounded">
                      {project.location.source}
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
              onClick={() => setShowProjectInfo(!showProjectInfo)}
              className="text-white hover:bg-hwc-red/20"
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSidebarVisible(!sidebarVisible);
                if (window.potreeViewer && typeof window.potreeViewer.toggleSidebar === 'function') {
                  window.potreeViewer.toggleSidebar();
                }
              }}
              className="text-white hover:bg-hwc-red/20"
            >
              {sidebarVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
      {showProjectInfo && project && (
        <div className="absolute top-20 right-6 z-40 w-96">
          <Card className="bg-hwc-dark/95 backdrop-blur-md border border-hwc-red/20 text-white">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4 text-lg">Project Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-hwc-light">Job Number:</span>
                  <span className="font-mono">{project.jobNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-hwc-light">Project Name:</span>
                  <span className="font-medium">{project.projectName}</span>
                </div>
                {project.clientName && (
                  <div className="flex justify-between">
                    <span className="text-hwc-light">Client:</span>
                    <span>{project.clientName}</span>
                  </div>
                )}
                {project.description && (
                  <div>
                    <span className="text-hwc-light">Description:</span>
                    <p className="mt-1 text-xs leading-relaxed">{project.description}</p>
                  </div>
                )}
                {project.location && (
                  <div>
                    <span className="text-hwc-light">Location:</span>
                    <div className="mt-1 text-xs font-mono space-y-1">
                      <div>Lat: {project.location.latitude.toFixed(6)}</div>
                      <div>Lon: {project.location.longitude.toFixed(6)}</div>
                      {project.location.source && (
                        <div className="text-hwc-light/60">
                          Source: {project.location.source} 
                          {project.location.confidence && ` (${project.location.confidence})`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {project.crs && (
                  <div>
                    <span className="text-hwc-light">Coordinate System:</span>
                    <div className="mt-1 text-xs space-y-1">
                      <div>Horizontal: <span className="font-mono">{project.crs.horizontal}</span></div>
                      {project.crs.vertical && <div>Vertical: <span className="font-mono">{project.crs.vertical}</span></div>}
                      {project.crs.geoidModel && <div>Geoid: <span className="font-mono">{project.crs.geoidModel}</span></div>}
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
              <Button
                variant={mapType === "default" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMapType("default")}
                className={`text-xs h-9 ${mapType === "default" ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                Default
              </Button>
              <Button
                variant={mapType === "terrain" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMapType("terrain")}
                className={`text-xs h-9 ${mapType === "terrain" ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                Terrain
              </Button>
              <Button
                variant={mapType === "satellite" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMapType("satellite")}
                className={`text-xs h-9 ${mapType === "satellite" ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                Satellite
              </Button>
              <Button
                variant={mapType === "openstreet" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMapType("openstreet")}
                className={`text-xs h-9 ${mapType === "openstreet" ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                OpenStreet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Potree Container - following your original structure */}
      <div
        className="potree_container"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          left: 0,
          top: 0
        }}
      >
        <div
          id="potree_render_area"
          style={{
            backgroundImage: "url('/potree/build/potree/resources/images/background.jpg')",
            width: "100%",
            height: "100%"
          }}
        >
          <div id="sidebar_logo"></div>
        </div>
        <div id="potree_sidebar_container" />
      </div>

      {/* Custom Styles with HWC Color Palette */}
      <style jsx global>{`
        * {
          font-family: 'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #292C30;
        }
        
        /* Ensure Potree container is properly positioned */
        .potree_container {
          position: absolute !important;
          width: 100% !important;
          height: 100% !important;
          left: 0 !important;
          top: 0 !important;
          z-index: 1 !important;
          background: #292C30 !important;
        }
        
        /* Fix Potree sidebar with HWC styling - positioned below header */
        #potree_sidebar_container {
          background: rgba(41, 44, 48, 0.98) !important;
          backdrop-filter: blur(20px) !important;
          border-left: 2px solid rgba(238, 47, 39, 0.3) !important;
          z-index: 30 !important;
          overflow-y: auto !important;
          max-height: calc(100vh - 80px) !important;
          position: fixed !important;
          right: 0 !important;
          top: 80px !important;
          width: 320px !important;
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.4) !important;
        }
        
        /* Sidebar content styling */
        #potree_sidebar_container .potree_menu_content {
          overflow-y: auto !important;
          max-height: calc(100vh - 100px) !important;
          padding: 20px !important;
        }
        
        /* Custom scrollbar with HWC colors */
        #potree_sidebar_container::-webkit-scrollbar {
          width: 6px !important;
        }
        
        #potree_sidebar_container::-webkit-scrollbar-track {
          background: rgba(108, 104, 100, 0.2) !important;
          border-radius: 3px !important;
        }
        
        #potree_sidebar_container::-webkit-scrollbar-thumb {
          background: rgba(238, 47, 39, 0.7) !important;
          border-radius: 3px !important;
        }
        
        #potree_sidebar_container::-webkit-scrollbar-thumb:hover {
          background: rgba(238, 47, 39, 0.9) !important;
        }
        
        /* Modern accordion headers with HWC red */
        .ui-accordion-header {
          background: linear-gradient(135deg, rgba(238, 47, 39, 0.9), rgba(238, 47, 39, 0.7)) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          margin-bottom: 4px !important;
          padding: 12px 16px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          z-index: 31 !important;
          transition: all 0.2s ease !important;
          letter-spacing: -0.025em !important;
        }
        
        .ui-accordion-header:hover {
          background: linear-gradient(135deg, rgba(238, 47, 39, 1), rgba(238, 47, 39, 0.8)) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(238, 47, 39, 0.4) !important;
        }
        
        .ui-accordion-content {
          background: rgba(41, 44, 48, 0.95) !important;
          color: rgba(221, 212, 204, 1) !important;
          border: none !important;
          border-radius: 8px !important;
          z-index: 31 !important;
          overflow-y: auto !important;
          max-height: 400px !important;
        }
        
        /* Tools grid layout - CRITICAL FIX for proper grid display */
        .potree_toolbar,
        .potree_menu_tools,
        .pv-menu-tools,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube),
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 8px !important;
          padding: 16px !important;
          background: rgba(221, 212, 204, 0.08) !important;
          border-radius: 12px !important;
          margin: 8px 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        
        /* Tool buttons with HWC styling */
        .potree_toolbar button,
        .potree_menu_tools button,
        .pv-menu-tools button,
        .potree_toolbar .potree_button,
        .potree_menu_tools .potree_button,
        .pv-menu-tools .potree_button,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) button,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) button,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button {
          width: 100% !important;
          height: 44px !important;
          margin: 0 !important;
          padding: 8px !important;
          background: rgba(221, 212, 204, 0.12) !important;
          border: 1px solid rgba(238, 47, 39, 0.25) !important;
          border-radius: 8px !important;
          color: rgba(221, 212, 204, 1) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          box-sizing: border-box !important;
        }
        
        /* Tool button hover effects */
        .potree_toolbar button:hover,
        .potree_menu_tools button:hover,
        .pv-menu-tools button:hover,
        .potree_toolbar .potree_button:hover,
        .potree_menu_tools .potree_button:hover,
        .pv-menu-tools .potree_button:hover,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) button:hover,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) button:hover,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button:hover,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button:hover {
          background: rgba(238, 47, 39, 0.2) !important;
          border-color: rgba(238, 47, 39, 0.6) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(238, 47, 39, 0.25) !important;
          color: white !important;
        }
        
        /* Active tool button styling with HWC red */
        .potree_toolbar button.active,
        .potree_menu_tools button.active,
        .pv-menu-tools button.active,
        .potree_toolbar .potree_button.active,
        .potree_menu_tools .potree_button.active,
        .pv-menu-tools .potree_button.active,
        .potree_toolbar button.selected,
        .potree_menu_tools button.selected,
        .pv-menu-tools button.selected,
        .potree_toolbar .potree_button.selected,
        .potree_menu_tools .potree_button.selected,
        .pv-menu-tools .potree_button.selected,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) button.active,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) button.active,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button.active,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button.active,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) button.selected,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) button.selected,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button.selected,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button.selected {
          background: linear-gradient(135deg, rgba(238, 47, 39, 0.9), rgba(238, 47, 39, 0.7)) !important;
          border: 2px solid rgba(238, 47, 39, 1) !important;
          box-shadow: 0 0 16px rgba(238, 47, 39, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
          color: white !important;
          transform: translateY(-1px) !important;
        }
        
        /* Tool icons styling */
        .potree_toolbar img,
        .potree_menu_tools img,
        .pv-menu-tools img,
        .potree_toolbar .potree_button img,
        .potree_menu_tools .potree_button img,
        .pv-menu-tools .potree_button img,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) img,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) img,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button img,
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button img {
          width: 18px !important;
          height: 18px !important;
          filter: brightness(0) invert(1) !important;
        }
        
        /* Compass and navigation controls - FIXED positioning in bottom left */
        .potree_compass {
          z-index: 35 !important;
          position: fixed !important;
          bottom: 24px !important;
          left: 24px !important;
          background: rgba(41, 44, 48, 0.95) !important;
          border: 2px solid rgba(238, 47, 39, 0.7) !important;
          border-radius: 50% !important;
          padding: 12px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(238, 47, 39, 0.3) !important;
          pointer-events: auto !important;
          width: 64px !important;
          height: 64px !important;
          backdrop-filter: blur(20px) !important;
        }
        
        .potree_navigation_cube {
          z-index: 35 !important;
          position: fixed !important;
          bottom: 24px !important;
          left: 104px !important;
          background: rgba(41, 44, 48, 0.95) !important;
          border: 2px solid rgba(238, 47, 39, 0.7) !important;
          border-radius: 12px !important;
          padding: 12px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(238, 47, 39, 0.3) !important;
          pointer-events: auto !important;
          backdrop-filter: blur(20px) !important;
        }
        
        /* Render area styling */
        #potree_render_area {
          position: absolute !important;
          width: 100% !important;
          height: 100% !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 1 !important;
          background: linear-gradient(135deg, #292C30, #1a1d21) !important;
        }
        
        /* Form elements with HWC styling */
        #potree_sidebar_container input[type="text"],
        #potree_sidebar_container input[type="number"],
        #potree_sidebar_container select {
          background: rgba(221, 212, 204, 0.1) !important;
          color: rgba(221, 212, 204, 1) !important;
          border: 1px solid rgba(238, 47, 39, 0.3) !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
          font-size: 13px !important;
          transition: all 0.2s ease !important;
        }
        
        #potree_sidebar_container input[type="text"]:focus,
        #potree_sidebar_container input[type="number"]:focus,
        #potree_sidebar_container select:focus {
          border-color: rgba(238, 47, 39, 0.8) !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(238, 47, 39, 0.15) !important;
        }
        
        /* Labels with HWC light color */
        #potree_sidebar_container label,
        #potree_sidebar_container .potree_label {
          color: rgba(221, 212, 204, 0.9) !important;
          font-weight: 500 !important;
          font-size: 13px !important;
        }
        
        /* Range inputs with HWC red */
        input[type="range"] {
          -webkit-appearance: none !important;
          background: rgba(221, 212, 204, 0.2) !important;
          height: 6px !important;
          border-radius: 3px !important;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          width: 18px !important;
          height: 18px !important;
          background: linear-gradient(135deg, rgba(238, 47, 39, 1), rgba(238, 47, 39, 0.8)) !important;
          border-radius: 50% !important;
          cursor: pointer !important;
          box-shadow: 0 2px 8px rgba(238, 47, 39, 0.4) !important;
        }
        
        /* Checkbox and radio with HWC red */
        input[type="checkbox"],
        input[type="radio"] {
          accent-color: rgba(238, 47, 39, 1) !important;
        }
        
        /* Progress bars with HWC red */
        .potree_progress,
        .progress {
          background: rgba(221, 212, 204, 0.2) !important;
          border-radius: 6px !important;
          overflow: hidden !important;
          height: 6px !important;
        }
        
        .potree_progress .progress-bar,
        .progress .progress-bar {
          background: linear-gradient(90deg, rgba(238, 47, 39, 1), rgba(238, 47, 39, 0.8)) !important;
          border-radius: 6px !important;
        }
        
        /* Typography improvements */
        h1, h2, h3, h4, h5, h6 {
          font-weight: 600 !important;
          letter-spacing: -0.025em !important;
        }
        
        /* Button improvements */
        button {
          font-weight: 500 !important;
          transition: all 0.2s ease !important;
        }
        
        /* Menu list styling */
        .pv-menu-list {
          overflow-y: auto !important;
          max-height: 350px !important;
        }
        
        .pv-menu-list button,
        .pv-menu-list input,
        .pv-menu-list select {
          background: rgba(221, 212, 204, 0.1) !important;
          color: rgba(221, 212, 204, 1) !important;
          border: 1px solid rgba(238, 47, 39, 0.3) !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
          font-size: 13px !important;
          transition: all 0.2s ease !important;
        }
        
        .pv-menu-list button:hover {
          background: rgba(238, 47, 39, 0.2) !important;
          border-color: rgba(238, 47, 39, 0.6) !important;
        }
      `}</style>
    </>
  );
}
