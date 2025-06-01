import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string" || !project) return;

    const initializePotree = async () => {
      try {
        setLoadingProgress(40);
        
        // Wait for DOM to be ready and ensure the element exists
        await new Promise(resolve => {
          const checkElement = () => {
            const renderArea = document.getElementById("potree_render_area");
            if (renderArea && document.readyState === 'complete') {
              resolve(undefined);
            } else {
              setTimeout(checkElement, 50);
            }
          };
          checkElement();
        });

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

        setLoadingProgress(50);

        for (const src of scripts) {
          await loadScript(src);
        }

        setLoadingProgress(70);

        // Check if Potree is available
        if (!window.Potree) {
          throw new Error("Potree library failed to load");
        }

        // Ensure the render area element exists and has dimensions
        const renderArea = document.getElementById("potree_render_area");
        if (!renderArea) {
          throw new Error("Potree render area not found");
        }

        // Wait a bit more to ensure element is fully rendered and has dimensions
        await new Promise(resolve => setTimeout(resolve, 200));

        // Force dimensions if they're not set
        if (renderArea.clientWidth === 0 || renderArea.clientHeight === 0) {
          console.warn("Render area has no dimensions, setting default size");
          renderArea.style.width = "100%";
          renderArea.style.height = "100vh";
          renderArea.style.position = "absolute";
          renderArea.style.top = "0";
          renderArea.style.left = "0";
          
          // Wait for the style changes to take effect
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        setLoadingProgress(80);

        // Initialize Potree viewer
        const viewer = new window.Potree.Viewer(renderArea);
        viewer.setEDLEnabled(true);
        viewer.setFOV(60);
        viewer.setPointBudget(1_000_000);
        viewer.setDescription(project?.projectName || `Project ${jobNumber}`);
        
        viewer.loadGUI(() => {
          viewer.setLanguage("en");
          // Don't auto-toggle sidebar, let user control it
        });

        setLoadingProgress(90);

        // For demo purposes, we'll simulate a successful load without actual point cloud data
        // In a real implementation, you would load actual point cloud files here
        setTimeout(() => {
          setLoadingProgress(100);
          setTimeout(() => setLoading(false), 500);
        }, 1000);

        // Uncomment this section when you have actual point cloud data:
        /*
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4400";
        const cloudJsPath = `${baseUrl}/pointclouds/${jobNumber}/cloud.js`;
        const metadataPath = `${baseUrl}/pointclouds/${jobNumber}/metadata.json`;

        const response = await fetch(cloudJsPath, { method: "HEAD" });
        const pathToLoad = response.ok ? cloudJsPath : metadataPath;

        const loadCallback = (e: PotreeLoadEvent) => {
          if (e.pointcloud) {
            viewer.scene.addPointCloud(e.pointcloud);
            e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
            viewer.fitToScreen(0.5);
            setLoadingProgress(100);
            setTimeout(() => setLoading(false), 500);
          } else {
            console.error("Failed to load point cloud.");
            setError("Failed to load point cloud data");
          }
        };

        if (pathToLoad.endsWith("cloud.js")) {
          window.Potree.loadPointCloud(pathToLoad, "PointCloud", loadCallback);
        } else {
          window.Potree.loadPointCloud(metadataPath, jobNumber, loadCallback);
        }
        */

      } catch (err) {
        console.error("Error initializing Potree:", err);
        setError(`Failed to initialize point cloud viewer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    };

    // Add a delay to ensure DOM is ready
    const timeoutId = setTimeout(initializePotree, 500);

    return () => {
      clearTimeout(timeoutId);
      // Cleanup scripts if needed
      const scripts = document.querySelectorAll('script[src*="/potree/"]');
      scripts.forEach(script => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
    };
  }, [jobNumber, project]);

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
      
      {/* Load Potree CSS */}
      <Script id="potree-styles">
        {`
          // Load required CSS files
          function loadCSS(url) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            document.head.appendChild(link);
          }
          
          loadCSS('/potree/build/potree/potree.css');
          loadCSS('/potree/libs/jquery-ui/jquery-ui.min.css');
          loadCSS('/potree/libs/openlayers3/ol.css');
          loadCSS('/potree/libs/spectrum/spectrum.css');
          loadCSS('/potree/libs/jstree/themes/mixed/style.css');
          loadCSS('/potree/libs/Cesium/Widgets/CesiumWidget/CesiumWidget.css');
          loadCSS('/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css');
        `}
      </Script>

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
          position: "absolute",
          width: "100%",
          height: "100%",
          left: 0,
          top: 0,
          background: "linear-gradient(135deg, #2a3f5f 0%, #1a2332 100%)"
        }}
      >
        <div
          id="potree_render_area"
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #2a3f5f 0%, #1a2332 100%)"
          }}
        >
          <div id="sidebar_logo"></div>
        </div>
        <div 
          id="potree_sidebar_container" 
          style={{ 
            display: sidebarVisible ? 'block' : 'none',
            background: 'rgba(41, 44, 48, 0.95)',
            backdropFilter: 'blur(10px)'
          }}
        />
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        .potree_sidebar_container {
          background: rgba(41, 44, 48, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border-right: 1px solid rgba(238, 47, 39, 0.3) !important;
        }
        
        .potree_sidebar_container .ui-accordion-header {
          background: var(--hwc-red) !important;
          color: white !important;
          border: none !important;
        }
        
        .potree_sidebar_container .ui-accordion-content {
          background: rgba(41, 44, 48, 0.8) !important;
          color: white !important;
          border: none !important;
        }
        
        .potree_sidebar_container button,
        .potree_sidebar_container input,
        .potree_sidebar_container select {
          background: rgba(108, 104, 100, 0.8) !important;
          color: white !important;
          border: 1px solid rgba(238, 47, 39, 0.3) !important;
        }
        
        .potree_sidebar_container button:hover {
          background: var(--hwc-red) !important;
        }
        
        #potree_render_area canvas {
          border-radius: 0 !important;
        }
      `}</style>
    </>
  );
}
