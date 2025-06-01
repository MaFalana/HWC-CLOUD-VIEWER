import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
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

export default function PotreeViewer() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mapType, setMapType] = useState<"default" | "terrain" | "satellite" | "openstreet">("default");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const viewerRef = useRef<PotreeViewer | null>(null);
  const renderAreaRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  const initializePotree = useCallback(async () => {
    try {
      console.log("Starting Potree initialization...");
      setLoadingProgress(40);

      // Ensure render area and sidebar elements exist
      if (!renderAreaRef.current || !sidebarRef.current) {
        console.log("Render area or sidebar ref not available");
        return;
      }

      // Get the render area element
      const renderArea = document.getElementById("potree_render_area");
      if (!renderArea) {
        console.error("Potree render area not found");
        throw new Error("Potree render area not found");
      }

      // Force the render area to have dimensions
      renderArea.style.width = "100%";
      renderArea.style.height = "100%";
      renderArea.style.position = "absolute";
      renderArea.style.left = "0";
      renderArea.style.top = "0";
      
      // Get the sidebar container
      const sidebarContainer = document.getElementById("potree_sidebar_container");
      if (!sidebarContainer) {
        console.error("Potree sidebar container not found");
        // Not critical, we can continue without the sidebar
      } else {
        sidebarContainer.style.width = "100%";
        sidebarContainer.style.height = "100%";
        sidebarContainer.style.position = "absolute";
        sidebarContainer.style.right = "0";
        sidebarContainer.style.top = "0";
      }
      
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
      
      // Load scripts sequentially
      setLoadingProgress(50);
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
          setLoadingProgress(55 + Math.floor((i / scripts.length) * 25));
        } catch (err) {
          console.error(`Failed to load script ${scripts[i]}:`, err);
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
      
      // Verify render area dimensions before creating viewer
      console.log("Render area dimensions before viewer creation:", {
        width: renderArea.clientWidth,
        height: renderArea.clientHeight,
        offsetWidth: renderArea.offsetWidth,
        offsetHeight: renderArea.offsetHeight
      });
      
      // Create viewer
      const viewer = new window.Potree.Viewer(renderArea);
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
      
      // Try to load point cloud
      console.log("Loading point cloud...");
      
      // Try to load project-specific point cloud first
      const projectCloudPath = `/potree/pointclouds/${jobNumber}/cloud.js`;
      
      const checkPointCloudExists = async (url: string): Promise<boolean> => {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          return response.ok;
        } catch {
          return false;
        }
      };
      
      const projectExists = await checkPointCloudExists(projectCloudPath);
      
      if (projectExists) {
        window.Potree.loadPointCloud(projectCloudPath, project?.projectName || `Project ${jobNumber}`, (e) => {
          if (e.pointcloud) {
            console.log("Project point cloud loaded successfully");
            viewer.scene.addPointCloud(e.pointcloud);
            e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
            viewer.fitToScreen();
            
            // If project has location data, position the map view accordingly
            if (project?.location?.latitude && project?.location?.longitude) {
              // Set the map view to the project location
              try {
                // Access the map view if available in the Potree viewer
                const mapView = viewer.mapView;
                if (mapView) {
                  // Set the map center to the project location
                  mapView.setCenter([project.location.longitude, project.location.latitude]);
                  mapView.setZoom(15); // Adjust zoom level as needed
                }
              } catch (mapErr) {
                console.error("Failed to set map location:", mapErr);
              }
            }
            
            setLoadingProgress(100);
            setTimeout(() => {
              setLoading(false);
            }, 500);
          } else {
            console.log("Point cloud object not found in response");
            setLoadingProgress(100);
            setTimeout(() => {
              setLoading(false);
            }, 500);
          }
        });
      } else {
        // Try fallback demo point cloud
        const lionCloudPath = "/potree/pointclouds/lion/cloud.js";
        const lionExists = await checkPointCloudExists(lionCloudPath);
        
        if (lionExists) {
          window.Potree.loadPointCloud(lionCloudPath, "Demo PointCloud", (e) => {
            if (e.pointcloud) {
              console.log("Demo point cloud loaded successfully");
              viewer.scene.addPointCloud(e.pointcloud);
              e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
              viewer.fitToScreen();
              
              setLoadingProgress(100);
              setTimeout(() => {
                setLoading(false);
              }, 500);
            } else {
              console.log("Point cloud object not found in response");
              setLoadingProgress(100);
              setTimeout(() => {
                setLoading(false);
              }, 500);
            }
          });
        } else {
          console.log("No point cloud files found, showing empty viewer");
          setLoadingProgress(100);
          setTimeout(() => {
            setLoading(false);
          }, 500);
        }
      }
      
    } catch (err) {
      console.error("Error initializing Potree:", err);
      setError(`Failed to initialize point cloud viewer: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  }, [jobNumber, project]);

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string" || !project) return;

    // Initialize Potree with a delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      initializePotree();
    }, 1000);

    // Add a resize event listener to ensure the render area is properly sized
    const handleResize = () => {
      if (viewerRef.current) {
        // Force a resize of the viewer if needed
        const renderArea = document.getElementById("potree_render_area");
        if (renderArea) {
          renderArea.style.width = "100%";
          renderArea.style.height = "100%";
        }
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
      
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
  }, [jobNumber, project, initializePotree]);

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
              style={{ height: "auto" }}
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
            style={{ height: "auto" }}
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
        <title>{project?.projectName || `Project ${jobNumber}`} - HWC Engineering Cloud Viewer</title>
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
              {project?.projectName || `Project ${jobNumber}`}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (viewerRef.current) {
                  viewerRef.current.toggleSidebar();
                }
                setSidebarVisible(!sidebarVisible);
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
                style={{ width: "auto", height: "27px" }}
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
                onClick={() => {
                  setMapType("default");
                  if (viewerRef.current) {
                    try {
                      // Change map type if the viewer has a map view
                      const mapView = viewerRef.current.mapView;
                      if (mapView) {
                        // Reset to default map type
                        mapView.setMapType("DEFAULT");
                      }
                    } catch (err) {
                      console.error("Failed to change map type:", err);
                    }
                  }
                }}
                className="text-xs h-8 bg-hwc-dark text-white"
              >
                Default
              </Button>
              <Button
                variant={mapType === "terrain" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setMapType("terrain");
                  if (viewerRef.current) {
                    try {
                      // Change map type if the viewer has a map view
                      const mapView = viewerRef.current.mapView;
                      if (mapView) {
                        // Set to terrain map type
                        mapView.setMapType("TERRAIN");
                      }
                    } catch (err) {
                      console.error("Failed to change map type:", err);
                    }
                  }
                }}
                className="text-xs h-8"
              >
                Terrain
              </Button>
              <Button
                variant={mapType === "satellite" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setMapType("satellite");
                  if (viewerRef.current) {
                    try {
                      // Change map type if the viewer has a map view
                      const mapView = viewerRef.current.mapView;
                      if (mapView) {
                        // Set to satellite map type
                        mapView.setMapType("SATELLITE");
                      }
                    } catch (err) {
                      console.error("Failed to change map type:", err);
                    }
                  }
                }}
                className="text-xs h-8"
              >
                Satellite
              </Button>
              <Button
                variant={mapType === "openstreet" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setMapType("openstreet");
                  if (viewerRef.current) {
                    try {
                      // Change map type if the viewer has a map view
                      const mapView = viewerRef.current.mapView;
                      if (mapView) {
                        // Set to OpenStreetMap type
                        mapView.setMapType("OPENSTREETMAP");
                      }
                    } catch (err) {
                      console.error("Failed to change map type:", err);
                    }
                  }
                }}
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

      {/* Potree Container */}
      <div className="potree_container" style={{ position: "absolute", width: "100%", height: "100%", left: 0, top: 0 }}>
        <div 
          ref={renderAreaRef} 
          style={{ 
            position: "absolute", 
            width: "100%", 
            height: "100%", 
            left: 0, 
            top: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          {/* This div will be the actual render area for Potree */}
          <div 
            id="potree_render_area" 
            style={{ 
              position: "absolute", 
              width: "100%", 
              height: "100%", 
              left: 0, 
              top: 0 
            }}
          ></div>
        </div>
        <div 
          ref={sidebarRef} 
          style={{ 
            position: "absolute", 
            top: 0, 
            right: 0, 
            width: "300px", 
            height: "100%", 
            zIndex: 1000 
          }}
        >
          {/* This div will be the container for the Potree sidebar */}
          <div 
            id="potree_sidebar_container" 
            style={{ 
              position: "absolute", 
              width: "100%", 
              height: "100%", 
              top: 0, 
              right: 0 
            }}
          ></div>
        </div>
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
