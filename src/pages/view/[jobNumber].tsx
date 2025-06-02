import { useEffect, useState, useRef } from "react";
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
  const viewerRef = useRef<PotreeViewer | null>(null);

  // Cleanup function to remove existing Potree elements
  const cleanupPotree = () => {
    try {
      // Destroy existing viewer if it exists
      if (window.potreeViewer && typeof window.potreeViewer.destroy === 'function') {
        window.potreeViewer.destroy();
      }
      window.potreeViewer = undefined;
      viewerRef.current = null;

      // Remove existing Potree DOM elements
      const existingElements = document.querySelectorAll('.potree_container, #potree_render_area, #potree_sidebar_container, .potree_compass, .potree_navigation_cube');
      existingElements.forEach(el => el.remove());

      // Remove any scripts that might cause conflicts
      const potreeScripts = document.querySelectorAll('script[src*="potree"]');
      potreeScripts.forEach(script => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });

      console.log("Cleaned up existing Potree elements");
    } catch (error) {
      console.log("Error during cleanup:", error);
    }
  };

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string") return;

    // Cleanup any existing Potree instances
    cleanupPotree();

    // Create a simple initialization function that will be called after a delay
    const initializePotree = async () => {
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
        
        // Create fresh Potree container structure
        console.log("Creating fresh Potree container structure...");
        
        // Create main container
        const container = document.createElement("div");
        container.className = "potree_container";
        container.style.position = "absolute";
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.left = "0";
        container.style.top = "0";
        container.style.zIndex = "1";
        document.body.appendChild(container);
        
        // Create render area
        const renderArea = document.createElement("div");
        renderArea.id = "potree_render_area";
        renderArea.style.width = "100%";
        renderArea.style.height = "100vh";
        renderArea.style.position = "absolute";
        renderArea.style.top = "0";
        renderArea.style.left = "0";
        renderArea.style.backgroundImage = "url('/potree/build/potree/resources/images/background.jpg')";
        container.appendChild(renderArea);
        
        // Create sidebar logo element
        const sidebarLogo = document.createElement("div");
        sidebarLogo.id = "sidebar_logo";
        renderArea.appendChild(sidebarLogo);
        
        // Create sidebar container
        const sidebarContainer = document.createElement("div");
        sidebarContainer.id = "potree_sidebar_container";
        container.appendChild(sidebarContainer);
        
        // Load CSS files
        const loadCSS = (href: string): void => {
          if (document.querySelector(`link[href="${href}"]`)) return;
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = href;
          document.head.appendChild(link);
        };
        
        // Load required CSS files
        loadCSS("/potree/build/potree/potree.css");
        loadCSS("/potree/libs/jquery-ui/jquery-ui.min.css");
        loadCSS("/potree/libs/openlayers3/ol.css");
        loadCSS("/potree/libs/spectrum/spectrum.css");
        loadCSS("/potree/libs/jstree/themes/mixed/style.css");
        loadCSS("/potree/libs/Cesium/Widgets/CesiumWidget/CesiumWidget.css");
        loadCSS("/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css");
        
        // Load scripts sequentially
        const loadScript = (src: string): Promise<void> =>
          new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
              resolve();
              return;
            }
            
            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.onload = () => resolve();
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
        
        // Try to fetch project info from API
        try {
          const res = await fetch(`http://localhost:4400/pointclouds/${jobNumber}/info.json`);
          if (res.ok) {
            const data = await res.json();
            console.log("Project data:", data);
            setProjectName(data.projectName);
            projectData = { ...projectData, ...data };
          }
        } catch (error) {
          console.log("No project info found, using mock data", error);
        }
        
        setProject(projectData as Project);
        setLoadingProgress(85);
        
        // Create the Potree viewer
        console.log("Potree is available, creating viewer...");
        
        // Get the render area element
        const renderAreaElement = document.getElementById("potree_render_area");
        if (!renderAreaElement) {
          throw new Error("Potree render area not found");
        }
        
        // Create single viewer instance
        const viewer = new window.Potree.Viewer(renderAreaElement);
        viewerRef.current = viewer;
        window.potreeViewer = viewer;
        
        viewer.setEDLEnabled(true);
        viewer.setFOV(60);
        viewer.setPointBudget(1_000_000);
        viewer.setDescription(projectData.projectName || "");
        
        viewer.loadGUI(() => {
          viewer.setLanguage("en");
          console.log("Potree GUI loaded");
        });
        
        // Load point cloud
        console.log("Loading point cloud...");
        const base = "http://localhost:4400/pointclouds/";
        const cloudJsPath = `${base}${jobNumber}/cloud.js`;
        const metadataPath = `${base}${jobNumber}/metadata.json`;
        const sourcesJsonPath = `${base}${jobNumber}/sources.json`;
        
        try {
          // Check which files exist
          let cloudJsExists = false;
          let metadataExists = false;
          let sourcesJsonExists = false;
          
          try {
            const response = await fetch(cloudJsPath, { method: "HEAD" });
            cloudJsExists = response.ok;
          } catch (error) {
            console.log("Error checking cloud.js:", error);
          }
          
          try {
            const response = await fetch(metadataPath, { method: "HEAD" });
            metadataExists = response.ok;
          } catch (error) {
            console.log("Error checking metadata.json:", error);
          }
          
          try {
            const response = await fetch(sourcesJsonPath, { method: "HEAD" });
            sourcesJsonExists = response.ok;
          } catch (error) {
            console.log("Error checking sources.json:", error);
          }
          
          // Determine which file to load
          let pathToLoad = null;
          
          if (cloudJsExists) {
            pathToLoad = cloudJsPath;
            console.log("Using cloud.js for point cloud loading");
          } else if (metadataExists) {
            pathToLoad = metadataPath;
            console.log("Using metadata.json for point cloud loading");
          } else if (sourcesJsonExists) {
            // For sources.json, we'll use the example metadata.json as a fallback
            // since sources.json doesn't contain all the data needed for Potree
            pathToLoad = "/pointclouds/example/metadata.json";
            console.log("Using example metadata.json for point cloud loading (sources.json found)");
          } else {
            // If none exists, use example metadata.json
            pathToLoad = "/pointclouds/example/metadata.json";
            console.log("Using example metadata.json for point cloud loading (no files found)");
          }
          
          if (!pathToLoad) {
            throw new Error("No point cloud data found");
          }
          
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
        } catch (loadError) {
          console.error("Error loading point cloud:", loadError);
          setLoadingProgress(100);
          setTimeout(() => {
            setLoading(false);
          }, 500);
        }
      } catch (err) {
        console.error("Error initializing Potree:", err);
        setError(`Failed to initialize point cloud viewer: ${err instanceof Error ? err.message : "Unknown error"}`);
        setLoading(false);
      }
    };
    
    // Start initialization after a delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      initializePotree();
    }, 1000);
    
    return () => {
      clearTimeout(timeoutId);
      cleanupPotree();
    };
  }, [jobNumber]);

  // Effect to update map type when it changes
  useEffect(() => {
    if (!loading && project && viewerRef.current) {
      try {
        const viewer = viewerRef.current;
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

      {/* Custom Sidebar Toggle Button - positioned correctly */}
      <div className="absolute top-20 right-6 z-40">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSidebarVisible(!sidebarVisible);
            // Custom sidebar toggle implementation
            const sidebar = document.getElementById('potree_sidebar_container');
            if (sidebar) {
              if (sidebarVisible) {
                sidebar.style.display = 'none';
              } else {
                sidebar.style.display = 'block';
              }
            }
          }}
          className="text-white hover:bg-hwc-red/20 bg-hwc-dark/95 backdrop-blur-md border border-hwc-red/20"
        >
          {sidebarVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Project Info Panel */}
      {showProjectInfo && project && (
        <div className="absolute top-20 right-20 z-40 w-96">
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

      {/* Custom Styles */}
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
        
        /* Fix Potree sidebar with modern styling - ensure it starts below header */
        #potree_sidebar_container {
          background: rgba(41, 44, 48, 0.98) !important;
          backdrop-filter: blur(20px) !important;
          border-left: 1px solid rgba(238, 47, 39, 0.2) !important;
          z-index: 30 !important;
          overflow-y: auto !important;
          max-height: calc(100vh - 80px) !important;
          position: fixed !important;
          right: 0 !important;
          top: 80px !important;
          width: 320px !important;
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3) !important;
          display: ${sidebarVisible ? 'block' : 'none'} !important;
        }
        
        /* Sidebar content styling */
        #potree_sidebar_container .potree_menu_content {
          overflow-y: auto !important;
          max-height: calc(100vh - 100px) !important;
          padding: 20px !important;
        }
        
        /* Accordion styling with modern design */
        #potree_sidebar_container .ui-accordion .ui-accordion-content {
          overflow-y: auto !important;
          max-height: 400px !important;
          padding: 16px !important;
          background: rgba(221, 212, 204, 0.05) !important;
          border-radius: 8px !important;
          margin-top: 8px !important;
        }
        
        /* Custom scrollbar */
        #potree_sidebar_container::-webkit-scrollbar {
          width: 6px !important;
        }
        
        #potree_sidebar_container::-webkit-scrollbar-track {
          background: rgba(108, 104, 100, 0.2) !important;
          border-radius: 3px !important;
        }
        
        #potree_sidebar_container::-webkit-scrollbar-thumb {
          background: rgba(238, 47, 39, 0.6) !important;
          border-radius: 3px !important;
        }
        
        #potree_sidebar_container::-webkit-scrollbar-thumb:hover {
          background: rgba(238, 47, 39, 0.8) !important;
        }
        
        /* Modern accordion headers */
        .ui-accordion-header {
          background: linear-gradient(135deg, rgba(238, 47, 39, 0.9), rgba(238, 47, 39, 0.7)) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          margin-bottom: 4px !important;
          padding: 12px 16px !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          z-index: 31 !important;
          transition: all 0.2s ease !important;
        }
        
        .ui-accordion-header:hover {
          background: linear-gradient(135deg, rgba(238, 47, 39, 1), rgba(238, 47, 39, 0.8)) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(238, 47, 39, 0.3) !important;
        }
        
        .ui-accordion-content {
          background: rgba(41, 44, 48, 0.9) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          z-index: 31 !important;
          overflow-y: auto !important;
          max-height: 400px !important;
        }
        
        /* Menu content styling */
        .potree_menu_content {
          background: transparent !important;
          color: white !important;
          overflow-y: auto !important;
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
          color: white !important;
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
        
        /* Modern tools grid layout - CRITICAL FIX */
        .potree_toolbar,
        .potree_menu_tools,
        .pv-menu-tools,
        div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube),
        div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 8px !important;
          padding: 16px !important;
          background: rgba(221, 212, 204, 0.05) !important;
          border-radius: 12px !important;
          margin: 8px 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        
        /* Force grid layout for measurement tools specifically */
        div[class*="measurement"] .potree_toolbar,
        div[class*="measurement"] .potree_menu_tools,
        div[class*="measurement"] .pv-menu-tools {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 6px !important;
        }
        
        /* Modern tool buttons */
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
          background: rgba(221, 212, 204, 0.1) !important;
          border: 1px solid rgba(238, 47, 39, 0.2) !important;
          border-radius: 8px !important;
          color: white !important;
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
          border-color: rgba(238, 47, 39, 0.5) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(238, 47, 39, 0.2) !important;
        }
        
        /* Active tool button styling */
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
          box-shadow: 0 0 16px rgba(238, 47, 39, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
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
        
        /* Perfect scrollbar styling */
        .ps__rail-y {
          z-index: 32 !important;
          opacity: 0.6 !important;
        }
        
        .ps__thumb-y {
          background-color: rgba(238, 47, 39, 0.8) !important;
          border-radius: 3px !important;
        }
        
        /* Dropdown and select styling */
        #potree_sidebar_container select,
        #potree_sidebar_container .ui-selectmenu-button {
          z-index: 33 !important;
          background: rgba(221, 212, 204, 0.1) !important;
          color: white !important;
          border: 1px solid rgba(238, 47, 39, 0.3) !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
        }
        
        /* Modern compass and navigation controls - positioned in bottom left */
        .potree_compass {
          z-index: 35 !important;
          position: fixed !important;
          bottom: 24px !important;
          left: 24px !important;
          background: rgba(41, 44, 48, 0.95) !important;
          border: 2px solid rgba(238, 47, 39, 0.6) !important;
          border-radius: 50% !important;
          padding: 12px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(238, 47, 39, 0.2) !important;
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
          border: 2px solid rgba(238, 47, 39, 0.6) !important;
          border-radius: 12px !important;
          padding: 12px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(238, 47, 39, 0.2) !important;
          pointer-events: auto !important;
          backdrop-filter: blur(20px) !important;
        }
        
        /* Canvas styling */
        .potree_compass canvas,
        .potree_navigation_cube canvas {
          border-radius: 6px !important;
        }
        
        /* Menu and toolbar styling */
        .potree_menu,
        .potree_toolbar {
          z-index: 31 !important;
          background: rgba(41, 44, 48, 0.95) !important;
          border: 1px solid rgba(238, 47, 39, 0.2) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(20px) !important;
        }
        
        /* Overlay styling */
        .potree_container .ui-widget-overlay {
          z-index: 29 !important;
        }
        
        /* Scrollbar for sidebar content */
        #potree_sidebar_container * {
          scrollbar-width: thin;
          scrollbar-color: rgba(238, 47, 39, 0.6) rgba(108, 104, 100, 0.3);
        }
        
        #potree_sidebar_container .pv-menu-list {
          z-index: 32 !important;
        }
        
        /* Measurement tools and annotations */
        .potree_annotation,
        .potree_measurement {
          color: rgba(238, 47, 39, 1) !important;
          background: rgba(41, 44, 48, 0.9) !important;
          border: 1px solid rgba(238, 47, 39, 0.5) !important;
          border-radius: 6px !important;
          padding: 6px 12px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          backdrop-filter: blur(10px) !important;
        }
        
        /* Modern range inputs */
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
          box-shadow: 0 2px 8px rgba(238, 47, 39, 0.3) !important;
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 18px !important;
          height: 18px !important;
          background: linear-gradient(135deg, rgba(238, 47, 39, 1), rgba(238, 47, 39, 0.8)) !important;
          border-radius: 50% !important;
          cursor: pointer !important;
          border: none !important;
          box-shadow: 0 2px 8px rgba(238, 47, 39, 0.3) !important;
        }
        
        /* Checkbox and radio styling */
        input[type="checkbox"],
        input[type="radio"] {
          accent-color: rgba(238, 47, 39, 1) !important;
        }
        
        /* Text input styling */
        #potree_sidebar_container input[type="text"],
        #potree_sidebar_container input[type="number"] {
          background: rgba(221, 212, 204, 0.1) !important;
          color: white !important;
          border: 1px solid rgba(238, 47, 39, 0.3) !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
          font-size: 13px !important;
          transition: all 0.2s ease !important;
        }
        
        #potree_sidebar_container input[type="text"]:focus,
        #potree_sidebar_container input[type="number"]:focus {
          border-color: rgba(238, 47, 39, 0.8) !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(238, 47, 39, 0.1) !important;
        }
        
        /* Label styling */
        #potree_sidebar_container label,
        #potree_sidebar_container .potree_label {
          color: rgba(221, 212, 204, 0.9) !important;
          font-weight: 500 !important;
          font-size: 13px !important;
        }
        
        /* Progress bar styling */
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
        
        /* Loading screen styling */
        .loading-screen {
          background: linear-gradient(135deg, #292C30, #1a1d21) !important;
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
      `}</style>
    </>
  );
}
