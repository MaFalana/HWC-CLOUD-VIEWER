
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Menu, X, MapPin, Info } from "lucide-react";
import { Project } from "@/types/project";
import { potreeLocationService } from "@/services/potreeLocationService";
import { projectService } from "@/services/projectService";

declare global {
  interface Window {
    Potree: any;
    viewer: any;
    $: any;
  }
}

export default function PotreeViewer() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mapType, setMapType] = useState<"default" | "terrain" | "satellite" | "openstreet">("default");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const renderAreaRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string") return;

    const initializeViewer = async () => {
      try {
        setLoadingProgress(10);
        
        // Create fallback project data
        const fallbackProject: Project = {
          jobNumber: jobNumber as string,
          projectName: `Project ${jobNumber}`,
          clientName: "Demo Client",
          acquistionDate: new Date().toISOString(),
          description: "Point cloud project",
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

        setProject(fallbackProject);
        setLoadingProgress(30);

        // Load Potree scripts and initialize
        await loadPotreeScripts();
        setLoadingProgress(50);
        
        // Initialize Potree viewer
        await initializePotree(jobNumber, fallbackProject.projectName);

        // Try to fetch real project data in background
        try {
          const mongoDataPromise = projectService.getProject(jobNumber);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('MongoDB fetch timeout')), 3000)
          );
          
          const mongoProjectData = await Promise.race([mongoDataPromise, timeoutPromise]) as Project;
          if (mongoProjectData) {
            setProject(prev => ({ ...prev, ...mongoProjectData }));
            console.log("Updated with MongoDB project data");
          }
        } catch (error) {
          console.log("Failed to fetch project data from MongoDB:", error);
        }

        try {
          const potreeDataPromise = potreeLocationService.getProjectInfo(jobNumber);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Potree fetch timeout')), 3000)
          );
          
          const potreeProjectData = await Promise.race([potreeDataPromise, timeoutPromise]) as Partial<Project>;
          if (potreeProjectData) {
            setProject(prev => ({ ...prev, ...potreeProjectData }));
            console.log("Updated with Potree project data");
          }
        } catch (error) {
          console.log("Failed to fetch Potree project data:", error);
        }

      } catch (err) {
        console.error("Error in initializeViewer:", err);
        setLoadingError(`Failed to initialize viewer: ${err instanceof Error ? err.message : "Unknown error"}`);
        setLoadingProgress(100);
        setLoading(false);
      }
    };

    initializeViewer();
  }, [jobNumber]);

  const loadPotreeScripts = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if Potree is already loaded
      if (window.Potree) {
        console.log("Potree already loaded");
        resolve();
        return;
      }

      console.log("Loading Potree scripts...");

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

      let loadedCount = 0;
      const totalScripts = scripts.length;

      const loadScript = (src: string) => {
        return new Promise<void>((scriptResolve, scriptReject) => {
          // Check if script is already loaded
          const existingScript = document.querySelector(`script[src="${src}"]`);
          if (existingScript) {
            console.log(`Script already loaded: ${src}`);
            scriptResolve();
            return;
          }

          console.log(`Loading script: ${src}`);
          const script = document.createElement("script");
          script.src = src;
          script.onload = () => {
            loadedCount++;
            console.log(`Loaded script ${loadedCount}/${totalScripts}: ${src}`);
            setLoadingProgress(30 + (loadedCount / totalScripts) * 20);
            scriptResolve();
          };
          script.onerror = () => {
            console.error(`Failed to load script: ${src}`);
            scriptReject(new Error(`Failed to load script: ${src}`));
          };
          document.head.appendChild(script);
        });
      };

      // Load scripts sequentially
      const loadSequentially = async () => {
        try {
          for (const script of scripts) {
            await loadScript(script);
          }
          
          // Wait a bit for Potree to be fully initialized
          setTimeout(() => {
            if (window.Potree) {
              console.log("Potree library loaded successfully");
              resolve();
            } else {
              console.error("Potree library not available after loading scripts");
              reject(new Error("Potree library not available after loading scripts"));
            }
          }, 500);
        } catch (error) {
          console.error("Error loading scripts:", error);
          reject(error);
        }
      };

      loadSequentially();
    });
  };

  const initializePotree = async (jobNum: string, projectName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        setLoadingProgress(60);
        
        if (!renderAreaRef.current) {
          reject(new Error("Render area not found"));
          return;
        }

        // Check if Potree is available
        if (!window.Potree) {
          reject(new Error("Potree library not loaded"));
          return;
        }

        // Clear any existing content
        renderAreaRef.current.innerHTML = "";
        
        // Wait a bit for DOM to be ready
        setTimeout(() => {
          try {
            console.log("Creating Potree viewer...");
            
            // Initialize Potree viewer
            const viewer = new window.Potree.Viewer(renderAreaRef.current);
            window.viewer = viewer;
            
            viewer.setEDLEnabled(true);
            viewer.setFOV(60);
            viewer.setPointBudget(3 * 1000 * 1000);
            viewer.setDescription(projectName);
            viewer.setLanguage("en");
            
            setLoadingProgress(70);
            
            viewer.loadGUI(() => {
              console.log("Potree GUI loaded");
              setLoadingProgress(80);
              
              // Apply custom styling
              setTimeout(() => {
                try {
                  if (window.$) {
                    window.$('.potree_toolbar, .potree_menu_tools, .pv-menu-tools, div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube), div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube)').css({
                      'display': 'grid',
                      'grid-template-columns': 'repeat(4, 1fr)',
                      'gap': '8px',
                      'width': '100%'
                    });
                    
                    window.$('.potree_compass').css({
                      'position': 'fixed',
                      'bottom': '24px',
                      'right': '24px',
                      'left': 'auto',
                      'top': 'auto',
                      'z-index': '35'
                    });
                    
                    window.$('.potree_navigation_cube').css({
                      'position': 'fixed',
                      'bottom': '24px',
                      'right': '104px',
                      'left': 'auto',
                      'top': 'auto',
                      'z-index': '35'
                    });
                    
                    window.$('#potree_sidebar_container').perfectScrollbar();
                  }
                } catch (e) {
                  console.error("Error applying custom styles:", e);
                }
                
                setLoadingProgress(85);
                
                // Load point cloud
                loadPointCloud(jobNum, projectName, viewer, resolve, reject);
              }, 100);
            });
          } catch (error) {
            console.error("Error creating Potree viewer:", error);
            reject(error);
          }
        }, 200);
        
      } catch (error) {
        console.error("Error initializing Potree:", error);
        reject(error);
      }
    });
  };

  const loadPointCloud = (jobNum: string, projectName: string, viewer: any, resolve: () => void, reject: (error: Error) => void) => {
    const pointCloudUrl = `/pointclouds/${jobNum}/metadata.json`;
    const fallbackUrls = [
      { url: pointCloudUrl, name: projectName },
      { url: "/pointclouds/example/metadata.json", name: "Default Example Cloud" }
    ];

    let currentIndex = 0;

    const attemptLoad = () => {
      if (currentIndex >= fallbackUrls.length) {
        console.log("All point cloud loading attempts completed. Viewer ready without point cloud.");
        setLoadingProgress(100);
        setLoading(false);
        resolve();
        return;
      }

      const { url, name } = fallbackUrls[currentIndex];
      console.log(`Attempting to load: ${name} from ${url}`);
      setLoadingProgress(85 + (currentIndex * 5));

      window.Potree.loadPointCloud(url, name, (e: any) => {
        if (e.type === 'loading_failed') {
          console.warn(`Failed to load ${name} (${url}). Trying next...`);
          currentIndex++;
          attemptLoad();
          return;
        }
        
        if (e.pointcloud) {
          console.log(`Successfully loaded point cloud: ${name} from ${url}`);
          const scene = viewer.scene;
          const pointcloud = e.pointcloud;
          const material = pointcloud.material;

          material.size = 1;
          material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
          material.shape = window.Potree.PointShape.SQUARE;
          material.activeAttributeName = "rgba";

          scene.addPointCloud(pointcloud);
          viewer.fitToScreen();
          
          setLoadingProgress(100);
          setLoading(false);
          resolve();
        } else {
          console.warn(`No pointcloud object in event for ${name} (${url}), trying next.`);
          currentIndex++;
          attemptLoad();
        }
      });
    };

    attemptLoad();
  };

  // Handle sidebar toggle
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
    if (window.viewer && typeof window.viewer.toggleSidebar === 'function') {
      try {
        window.viewer.toggleSidebar();
      } catch (error) {
        console.log("Could not toggle sidebar:", error);
      }
    }
  };

  // Handle map type changes
  const handleMapTypeChange = (newMapType: typeof mapType) => {
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
            {loadingProgress < 50 && (
              <p className="text-xs text-hwc-light/60 mt-2">Initializing viewer...</p>
            )}
            {loadingProgress >= 50 && loadingProgress < 80 && (
              <p className="text-xs text-hwc-light/60 mt-2">Loading Potree scripts...</p>
            )}
            {loadingProgress >= 80 && loadingProgress < 100 && (
              <p className="text-xs text-hwc-light/60 mt-2">Loading point cloud...</p>
            )}
          </div>
          
          <div className="mt-8 text-sm text-hwc-light">
            Powered by HWC Engineering
          </div>
        </div>
      </div>
    );
  }

  if (loadingError) {
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
          <p className="mb-6 text-hwc-light">{loadingError}</p>
          <div className="space-y-3">
            <Button
              onClick={() => {
                setLoadingError(null);
                setLoading(true);
                setLoadingProgress(0);
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
    );
  }

  return (
    <>
      <Head>
        <title>{project?.projectName || `Project ${jobNumber}`} - HWC Engineering | Cloud Viewer</title>
        <meta name="description" content="Point cloud viewer" />
        <link rel="icon" href="/hwc-angle-logo-16px-mbe1odp0.png" />
        
        {/* Potree CSS */}
        <link rel="stylesheet" href="/potree/build/potree/potree.css" />
        <link rel="stylesheet" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
        <link rel="stylesheet" href="/potree/libs/openlayers3/ol.css" />
        <link rel="stylesheet" href="/potree/libs/spectrum/spectrum.css" />
        <link rel="stylesheet" href="/potree/libs/jstree/themes/mixed/style.css" />
        <link rel="stylesheet" href="/potree/libs/Cesium/Widgets/CesiumWidget/CesiumWidget.css" />
        <link rel="stylesheet" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css" />
        
        <style jsx>{`
          body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; background: #292C30; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          #potree_render_area { position: absolute; width: 100%; height: 100%; left: 0; top: 0; background: #292C30; }
          #potree_sidebar_container { background: rgba(41, 44, 48, 0.98); backdrop-filter: blur(20px); border-left: 2px solid rgba(238, 47, 39, 0.3); z-index: 30; overflow-y: auto; max-height: calc(100vh - 80px); position: fixed; right: 0; top: 80px; width: 320px; box-shadow: -10px 0 30px rgba(0, 0, 0, 0.4); }
          #potree_sidebar_container::-webkit-scrollbar { width: 6px; }
          #potree_sidebar_container::-webkit-scrollbar-track { background: rgba(108, 104, 100, 0.2); border-radius: 3px; }
          #potree_sidebar_container::-webkit-scrollbar-thumb { background: rgba(238, 47, 39, 0.7); border-radius: 3px; }
          #potree_sidebar_container::-webkit-scrollbar-thumb:hover { background: rgba(238, 47, 39, 0.9); }
          .ui-accordion-header { background: linear-gradient(135deg, rgba(238, 47, 39, 0.9), rgba(238, 47, 39, 0.7)) !important; color: white !important; border: none !important; border-radius: 8px !important; margin-bottom: 4px !important; padding: 12px 16px !important; font-weight: 600 !important; font-size: 14px !important; z-index: 31 !important; transition: all 0.2s ease !important; letter-spacing: -0.025em !important; }
          .ui-accordion-header:hover { background: linear-gradient(135deg, rgba(238, 47, 39, 1), rgba(238, 47, 39, 0.8)) !important; transform: translateY(-1px) !important; box-shadow: 0 4px 12px rgba(238, 47, 39, 0.4) !important; }
          .ui-accordion-content { background: rgba(41, 44, 48, 0.95) !important; color: rgba(221, 212, 204, 1) !important; border: none !important; border-radius: 8px !important; z-index: 31 !important; overflow-y: auto !important; max-height: 400px !important; }
          .potree_toolbar, .potree_menu_tools, .pv-menu-tools, div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube), div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 8px !important; padding: 16px !important; background: rgba(221, 212, 204, 0.08) !important; border-radius: 12px !important; margin: 8px 0 !important; width: 100% !important; box-sizing: border-box !important; }
          .potree_toolbar button, .potree_menu_tools button, .pv-menu-tools button, .potree_toolbar .potree_button, .potree_menu_tools .potree_button, .pv-menu-tools .potree_button, div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) button, div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) button, div[class*="tools"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button, div[class*="toolbar"]:not(.potree_compass):not(.potree_navigation_cube) .potree_button { width: 100% !important; height: 44px !important; margin: 0 !important; padding: 8px !important; background: rgba(221, 212, 204, 0.12) !important; border: 1px solid rgba(238, 47, 39, 0.25) !important; border-radius: 8px !important; color: rgba(221, 212, 204, 1) !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.2s ease !important; font-size: 12px !important; font-weight: 500 !important; cursor: pointer !important; box-sizing: border-box !important; }
          .potree_compass { z-index: 35 !important; position: fixed !important; bottom: 24px !important; right: 24px !important; left: auto !important; top: auto !important; background: rgba(41, 44, 48, 0.95) !important; border: 2px solid rgba(238, 47, 39, 0.7) !important; border-radius: 50% !important; padding: 12px !important; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(238, 47, 39, 0.3) !important; pointer-events: auto !important; width: 64px !important; height: 64px !important; backdrop-filter: blur(20px) !important; }
          .potree_navigation_cube { z-index: 35 !important; position: fixed !important; bottom: 24px !important; right: 104px !important; left: auto !important; top: auto !important; background: rgba(41, 44, 48, 0.95) !important; border: 2px solid rgba(238, 47, 39, 0.7) !important; border-radius: 12px !important; padding: 12px !important; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(238, 47, 39, 0.3) !important; pointer-events: auto !important; backdrop-filter: blur(20px) !important; }
        `}</style>
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
              {project?.projectName || `Project ${jobNumber}`}
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
              onClick={toggleSidebar}
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
                onClick={() => handleMapTypeChange("default")}
                className={`text-xs h-9 ${mapType === "default" ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                Default
              </Button>
              <Button
                variant={mapType === "terrain" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleMapTypeChange("terrain")}
                className={`text-xs h-9 ${mapType === "terrain" ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                Terrain
              </Button>
              <Button
                variant={mapType === "satellite" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleMapTypeChange("satellite")}
                className={`text-xs h-9 ${mapType === "satellite" ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                Satellite
              </Button>
              <Button
                variant={mapType === "openstreet" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleMapTypeChange("openstreet")}
                className={`text-xs h-9 ${mapType === "openstreet" ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                OpenStreet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Potree Render Area */}
      <div 
        ref={renderAreaRef}
        id="potree_render_area"
        className="absolute inset-0 w-full h-full z-10"
        style={{ background: "#292C30" }}
      />
      
      {/* Potree Sidebar Container */}
      <div 
        ref={sidebarRef}
        id="potree_sidebar_container"
        className="z-30"
      />
    </>
  );
}
