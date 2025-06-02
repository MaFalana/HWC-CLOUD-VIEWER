import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Menu, X } from "lucide-react";
import { Project } from "@/types/project";

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
interface ProjectData extends Project {
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const renderAreaRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string") return;

    // Create a simple initialization function that will be called after a delay
    const initializePotree = async () => {
      try {
        console.log("Starting Potree initialization...");
        
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
        let projectData: ProjectData = {
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
            address: "Indianapolis, IN"
          }
        };
        
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
        
        setProject(projectData);
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
        
        try {
          const response = await fetch(cloudJsPath, { method: "HEAD" });
          const pathToLoad = response.ok ? cloudJsPath : metadataPath;
          
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
                  if (mapView && typeof mapView.setCenter === 'function') {
                    mapView.setCenter([projectData.location.longitude, projectData.location.latitude]);
                    if (typeof mapView.setZoom === 'function') {
                      mapView.setZoom(15);
                    }
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
            window.Potree.loadPointCloud(metadataPath, jobNumber, loadCallback);
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
        setError(`Failed to initialize point cloud viewer: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
  }, [jobNumber]);

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
          </div>
          
          <div className="flex items-center gap-4">
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
