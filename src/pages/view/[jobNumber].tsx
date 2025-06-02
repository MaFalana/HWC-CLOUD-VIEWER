import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Menu, X, MapPin, Info } from "lucide-react";
import { Project } from "@/types/project";
import { potreeLocationService } from "@/services/potreeLocationService";
import { sourcesJsonService } from "@/services/sourcesJsonService";

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
  }
}

// Define a type for project data
interface ProjectData extends Omit<Project, 'location'> {
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    source?: 'potree_metadata' | 'potree_bounds' | 'crs_derived' | 'manual' | 'fallback';
    confidence?: 'high' | 'medium' | 'low';
  };
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
  const containerRef = useRef<HTMLDivElement>(null);
  const renderAreaRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string") return;

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
        
        // Create render area element if it doesn't exist
        console.log("Creating render area element...");
        if (!document.getElementById("potree_render_area")) {
          const renderArea = document.createElement("div");
          renderArea.id = "potree_render_area";
          (renderArea as HTMLElement).style.width = "100%";
          (renderArea as HTMLElement).style.height = "100vh";
          (renderArea as HTMLElement).style.position = "absolute";
          (renderArea as HTMLElement).style.top = "0";
          (renderArea as HTMLElement).style.left = "0";
          (renderArea as HTMLElement).style.backgroundImage = "url('/potree/build/potree/resources/images/background.jpg')";
          
          // Create sidebar logo element
          const sidebarLogo = document.createElement("div");
          sidebarLogo.id = "sidebar_logo";
          renderArea.appendChild(sidebarLogo);
          
          // Create container if it doesn't exist
          const container = document.querySelector(".potree_container") || document.createElement("div");
          container.className = "potree_container";
          if (!container.parentElement) {
            (container as HTMLElement).style.position = "absolute";
            (container as HTMLElement).style.width = "100%";
            (container as HTMLElement).style.height = "100%";
            (container as HTMLElement).style.left = "0";
            (container as HTMLElement).style.top = "0";
            document.body.appendChild(container);
          }
          
          // Add render area to container
          container.appendChild(renderArea);
          
          // Create sidebar container if it doesn't exist
          if (!document.getElementById("potree_sidebar_container")) {
            const sidebarContainer = document.createElement("div");
            sidebarContainer.id = "potree_sidebar_container";
            container.appendChild(sidebarContainer);
          }
        }
        
        // Create sidebar element if it doesn't exist
        console.log("Creating sidebar element...");
        if (!document.getElementById("potree_sidebar_container")) {
          const sidebarContainer = document.createElement("div");
          sidebarContainer.id = "potree_sidebar_container";
          const container = document.querySelector(".potree_container");
          if (container) {
            container.appendChild(sidebarContainer);
          }
        }
        
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
        } catch {
          console.log("No project info found, using mock data");
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
        
        const viewer = new window.Potree.Viewer(renderAreaElement);
        viewer.setEDLEnabled(true);
        viewer.setFOV(60);
        viewer.setPointBudget(1_000_000);
        viewer.setDescription(projectData.projectName);
        
        viewer.loadGUI(() => {
          viewer.setLanguage("en");
          viewer.toggleSidebar();
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
    };
  }, [jobNumber, mapType]);

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
      </Head>

      {/* Custom Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-hwc-dark/90 backdrop-blur-sm text-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="text-white hover:bg-hwc-red/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <div className="h-6 w-px bg-hwc-gray"></div>
            <h1 className="text-lg font-semibold">
              {projectName || project?.projectName || `Project ${jobNumber}`}
            </h1>
            {project?.location && (
              <div className="flex items-center gap-2 text-sm text-hwc-light">
                <MapPin className="h-3 w-3" />
                <span>
                  {project.location.latitude.toFixed(4)}, {project.location.longitude.toFixed(4)}
                  {project.location.source && (
                    <span className="ml-1 text-xs opacity-75">
                      ({project.location.source})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
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
                // Try to toggle Potree sidebar if available
                try {
                  if (window.Potree && document.querySelector('.potree_sidebar_container')) {
                    // Potree sidebar toggle logic would go here
                  }
                } catch (sidebarError) {
                  console.log("Potree sidebar toggle not available", sidebarError);
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
                width={80}
                height={27}
                priority
                className="h-7 hover:opacity-80 transition-opacity"
                style={{ width: "auto", height: "auto" }}
              />
            </a>
          </div>
        </div>
      </div>

      {/* Project Info Panel */}
      {showProjectInfo && project && (
        <div className="absolute top-20 right-4 z-40 w-80">
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Project Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Job Number:</span> {project.jobNumber}
                </div>
                <div>
                  <span className="font-medium">Project Name:</span> {project.projectName}
                </div>
                {project.clientName && (
                  <div>
                    <span className="font-medium">Client:</span> {project.clientName}
                  </div>
                )}
                {project.description && (
                  <div>
                    <span className="font-medium">Description:</span> {project.description}
                  </div>
                )}
                {project.location && (
                  <div>
                    <span className="font-medium">Location:</span>
                    <div className="ml-2 text-xs">
                      <div>Lat: {project.location.latitude.toFixed(6)}</div>
                      <div>Lon: {project.location.longitude.toFixed(6)}</div>
                      {project.location.source && (
                        <div className="text-gray-500">
                          Source: {project.location.source} 
                          {project.location.confidence && ` (${project.location.confidence})`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {project.crs && (
                  <div>
                    <span className="font-medium">Coordinate System:</span>
                    <div className="ml-2 text-xs">
                      <div>Horizontal: {project.crs.horizontal}</div>
                      {project.crs.vertical && <div>Vertical: {project.crs.vertical}</div>}
                      {project.crs.geoidModel && <div>Geoid: {project.crs.geoidModel}</div>}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map Type Controls */}
      <div className="absolute top-20 left-4 z-40">
        <Card className="bg-white/90 backdrop-blur-sm">
          <CardContent className="p-2">
            <div className="grid grid-cols-2 gap-1">
              <Button
                variant={mapType === "default" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMapType("default")}
                className="text-xs h-8"
              >
                Default
              </Button>
              <Button
                variant={mapType === "terrain" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMapType("terrain")}
                className="text-xs h-8"
              >
                Terrain
              </Button>
              <Button
                variant={mapType === "satellite" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMapType("satellite")}
                className="text-xs h-8"
              >
                Satellite
              </Button>
              <Button
                variant={mapType === "openstreet" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMapType("openstreet")}
                className="text-xs h-8"
              >
                OpenStreet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Compass */}
      <div className="absolute bottom-4 right-4 z-40">
        <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-white rounded-full relative">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-2 border-r-2 border-b-4 border-transparent border-b-hwc-red"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Potree Container with Refs */}
      <div
        ref={containerRef}
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
          ref={renderAreaRef}
          id="potree_render_area"
          style={{
            backgroundImage: "url('/potree/build/potree/resources/images/background.jpg')",
            width: "100%",
            height: "100%"
          }}
        >
          <div id="sidebar_logo"></div>
        </div>
        <div 
          ref={sidebarRef}
          id="potree_sidebar_container" 
        />
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        
        #potree_sidebar_container {
          background: rgba(41, 44, 48, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border-left: 1px solid rgba(238, 47, 39, 0.3) !important;
        }
        
        .potree_menu_content {
          background: rgba(41, 44, 48, 0.95) !important;
          color: white !important;
        }
        
        .ui-accordion-header {
          background: var(--hwc-red) !important;
          color: white !important;
          border: none !important;
        }
        
        .ui-accordion-content {
          background: rgba(41, 44, 48, 0.8) !important;
          color: white !important;
          border: none !important;
        }
        
        .pv-menu-list button,
        .pv-menu-list input,
        .pv-menu-list select {
          background: rgba(108, 104, 100, 0.8) !important;
          color: white !important;
          border: 1px solid rgba(238, 47, 39, 0.3) !important;
        }
        
        .pv-menu-list button:hover {
          background: var(--hwc-red) !important;
        }
      `}</style>
    </>
  );
}
