
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Script from "next/script";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Menu, X } from "lucide-react";
import { projectService } from "@/services/projectService";
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
  fitToScreen: (padding: number) => void;
}

interface PotreeLoadEvent {
  pointcloud: PointCloud;
}

interface PotreeStatic {
  Viewer: new (element: HTMLElement | null) => PotreeViewer;
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

export default function PotreeViewer() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mapType, setMapType] = useState<"default" | "terrain" | "satellite" | "openstreet">("default");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const renderAreaRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PotreeViewer | null>(null);

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string") return;

    const loadProject = async () => {
      try {
        setLoading(true);
        setLoadingProgress(10);
        const projectData = await projectService.getProject(jobNumber);
        setProject(projectData);
        setLoadingProgress(30);
      } catch (err) {
        console.error("Failed to load project:", err);
        setError("Failed to load project data");
        // Set mock project data for development when API fails
        setProject({
          jobNumber: jobNumber as string,
          projectName: `Project ${jobNumber}`,
          clientName: "Demo Client",
          acquistionDate: new Date().toISOString(),
          description: "Demo project for testing Potree viewer",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          projectType: "survey"
        });
        setLoadingProgress(30);
      }
    };

    loadProject();
  }, [jobNumber]);

  // Effect to handle sidebar visibility changes
  useEffect(() => {
    const sidebarContainer = document.getElementById("potree_sidebar_container");
    if (sidebarContainer) {
      sidebarContainer.style.display = sidebarVisible ? "block" : "none";
    }
  }, [sidebarVisible]);

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string" || !project) return;

    // Load CSS files
    const loadCSS = (url: string) => {
      if (document.querySelector(`link[href="${url}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    };

    const cssFiles = [
      "/potree/build/potree/potree.css",
      "/potree/libs/jquery-ui/jquery-ui.min.css",
      "/potree/libs/openlayers3/ol.css",
      "/potree/libs/spectrum/spectrum.css",
      "/potree/libs/jstree/themes/mixed/style.css",
      "/potree/libs/Cesium/Widgets/CesiumWidget/CesiumWidget.css",
      "/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css"
    ];

    cssFiles.forEach(loadCSS);

    // Initialize Potree with a delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      initializePotree();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      // Clean up
      if (viewerRef.current) {
        viewerRef.current = null;
      }
      
      // Remove scripts
      document.querySelectorAll('script[src*="/potree/"]').forEach(script => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
      
      // Remove CSS
      document.querySelectorAll('link[href*="/potree/"]').forEach(link => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [jobNumber, project]);

  const initializePotree = async () => {
    try {
      console.log("Starting Potree initialization...");
      setLoadingProgress(40);
      
      // Prepare DOM elements
      // First, ensure the container exists
      const container = document.querySelector(".potree_container");
      if (!container) {
        throw new Error("Potree container not found");
      }
      
      // Create render area if it doesn't exist
      let renderArea = document.getElementById("potree_render_area");
      if (!renderArea) {
        renderArea = document.createElement("div");
        renderArea.id = "potree_render_area";
        container.appendChild(renderArea);
      }
      
      // Set explicit dimensions and styles
      renderArea.style.width = "100vw";
      renderArea.style.height = "100vh";
      renderArea.style.position = "fixed";
      renderArea.style.top = "0";
      renderArea.style.left = "0";
      renderArea.style.zIndex = "1";
      renderArea.style.margin = "0";
      renderArea.style.padding = "0";
      renderArea.style.background = "linear-gradient(135deg, #2a3f5f 0%, #1a2332 100%)";
      
      // Force layout calculation
      renderArea.getBoundingClientRect();
      
      // Create sidebar container if it doesn't exist
      let sidebarContainer = document.getElementById("potree_sidebar_container");
      if (!sidebarContainer) {
        sidebarContainer = document.createElement("div");
        sidebarContainer.id = "potree_sidebar_container";
        sidebarContainer.style.position = "absolute";
        sidebarContainer.style.top = "0";
        sidebarContainer.style.right = "0";
        sidebarContainer.style.width = "300px";
        sidebarContainer.style.height = "100%";
        sidebarContainer.style.display = sidebarVisible ? "block" : "none";
        sidebarContainer.style.background = "rgba(41, 44, 48, 0.95)";
        sidebarContainer.style.backdropFilter = "blur(10px)";
        sidebarContainer.style.zIndex = "10";
        sidebarContainer.style.overflow = "auto";
        sidebarContainer.style.borderLeft = "1px solid rgba(238, 47, 39, 0.3)";
        container.appendChild(sidebarContainer);
      }
      
      // Update ref
      renderAreaRef.current = renderArea as HTMLDivElement;
      
      // Load scripts sequentially
      setLoadingProgress(45);
      console.log("Loading scripts...");
      
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
        try {
          await loadScript(scripts[i]);
          setLoadingProgress(50 + Math.floor((i / scripts.length) * 30));
        } catch (error) {
          console.error(`Failed to load script ${scripts[i]}:`, error);
        }
      }
      
      setLoadingProgress(80);
      
      // Wait for Potree to be available
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkPotree = () => {
          attempts++;
          if (window.Potree) {
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error("Potree not available after maximum attempts"));
          } else {
            setTimeout(checkPotree, 200);
          }
        };
        
        checkPotree();
      });
      
      console.log("Potree is available, creating viewer...");
      
      // Create Potree viewer
      if (!renderAreaRef.current) {
        throw new Error("Render area ref not available");
      }
      
      // Double-check dimensions
      console.log("Render area dimensions before viewer creation:", {
        width: renderAreaRef.current.clientWidth,
        height: renderAreaRef.current.clientHeight,
        offsetWidth: renderAreaRef.current.offsetWidth,
        offsetHeight: renderAreaRef.current.offsetHeight
      });
      
      // Create viewer
      const viewer = new window.Potree.Viewer(renderAreaRef.current);
      viewerRef.current = viewer;
      
      // Configure viewer
      viewer.setEDLEnabled(true);
      viewer.setFOV(60);
      viewer.setPointBudget(1_000_000);
      viewer.setDescription(project?.projectName || `Project ${jobNumber}`);
      
      setLoadingProgress(85);
      
      // Load GUI
      viewer.loadGUI(() => {
        console.log("Potree GUI loaded");
        viewer.setLanguage("en");
        setLoadingProgress(90);
      });
      
      // Load point cloud
      console.log("Loading point cloud...");
      const demoPointCloudPath = "/potree/pointclouds/lion/cloud.js";
      
      window.Potree.loadPointCloud(demoPointCloudPath, "PointCloud", (e: PotreeLoadEvent) => {
        if (e.pointcloud) {
          console.log("Point cloud loaded successfully");
          viewer.scene.addPointCloud(e.pointcloud);
          e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
          viewer.fitToScreen(0.5);
          setLoadingProgress(100);
          
          // Hide loading screen
          setTimeout(() => {
            setLoading(false);
          }, 500);
        } else {
          throw new Error("Failed to load point cloud");
        }
      });
      
    } catch (err) {
      console.error("Error initializing Potree:", err);
      setError(`Failed to initialize point cloud viewer: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

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
            />
            <h1 className="text-2xl font-semibold mb-2">
              {project?.projectName || `Project ${jobNumber}`}
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
        <title>{project?.projectName || `Project ${jobNumber}`} - HWC Cloud Viewer</title>
        <meta name="description" content="Point cloud viewer" />
        <link rel="icon" href="/favicon.ico" />
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
              {project?.projectName || `Project ${jobNumber}`}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarVisible(!sidebarVisible)}
              className="text-white hover:bg-hwc-red/20"
            >
              {sidebarVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <Image
              src="/hwc-logo-4c-mbe1obbx.png"
              alt="HWC Engineering"
              width={80}
              height={27}
              priority
              className="h-7 w-auto"
            />
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
                className="text-xs h-8 bg-hwc-dark text-white"
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

      {/* Main Potree Container */}
      <div
        className="potree_container"
        style={{
          position: "fixed",
          width: "100vw",
          height: "100vh",
          left: 0,
          top: 0,
          zIndex: 1,
          background: "linear-gradient(135deg, #2a3f5f 0%, #1a2332 100%)",
          overflow: "hidden"
        }}
      >
        <div 
          id="potree_render_area"
          ref={renderAreaRef}
          style={{
            width: "100vw",
            height: "100vh",
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 1
          }}
        ></div>
        <div 
          id="potree_sidebar_container"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "300px",
            height: "100%",
            display: sidebarVisible ? "block" : "none",
            background: "rgba(41, 44, 48, 0.95)",
            backdropFilter: "blur(10px)",
            zIndex: 10,
            overflow: "auto"
          }}
        ></div>
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        #potree_sidebar_container {
          background: rgba(41, 44, 48, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border-left: 1px solid rgba(238, 47, 39, 0.3) !important;
          position: absolute !important;
          top: 0 !important;
          right: 0 !important;
          width: 300px !important;
          height: 100% !important;
          z-index: 10 !important;
          overflow: auto !important;
        }
        
        .potree_menu_content {
          background: rgba(41, 44, 48, 0.95) !important;
          color: white !important;
        }
        
        .potree_container {
          position: fixed !important;
          width: 100vw !important;
          height: 100vh !important;
          left: 0 !important;
          top: 0 !important;
          z-index: 1 !important;
        }
        
        #potree_render_area {
          width: 100vw !important;
          height: 100vh !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 1 !important;
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
        
        #potree_render_area canvas {
          border-radius: 0 !important;
        }
      `}</style>
    </>
  );
}
