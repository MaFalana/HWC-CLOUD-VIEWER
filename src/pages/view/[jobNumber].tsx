
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string") return;

    const fetchProjectData = async () => {
      try {
        setLoadingProgress(10);
        
        // First, try to get the project data from MongoDB using projectService
        let mongoProjectData: Project | null = null;
        try {
          mongoProjectData = await projectService.getProject(jobNumber);
          console.log("MongoDB project data:", mongoProjectData);
        } catch (error) {
          console.log("Failed to fetch project data from MongoDB:", error);
        }
        
        setLoadingProgress(30);
        
        // Next, get the Potree project data
        let potreeProjectData: Partial<Project> | null = null;
        try {
          potreeProjectData = await potreeLocationService.getProjectInfo(jobNumber);
          console.log("Potree project data:", potreeProjectData);
        } catch (error) {
          console.log("Failed to fetch Potree project data:", error);
        }
        
        // Create a base project data object
        let projectData: Partial<Project> = {
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

        // Merge data in priority order: MongoDB data (highest priority), then Potree data
        if (mongoProjectData) {
          projectData = { ...projectData, ...mongoProjectData };
          console.log("Using MongoDB project data:", projectData);
        } else if (potreeProjectData) {
          projectData = { ...projectData, ...potreeProjectData };
          console.log("Using Potree project data:", projectData);
        }

        setProject(projectData as Project);
        setLoadingProgress(50);

        // Load the Potree viewer
        if (iframeRef.current) {
          // Create a proper Potree viewer URL
          const potreeViewerUrl = createPotreeViewerUrl(jobNumber);
          console.log("Loading Potree viewer with URL:", potreeViewerUrl);
          
          iframeRef.current.src = potreeViewerUrl;
          
          // Set up iframe load handler
          const handleIframeLoad = () => {
            console.log("Iframe loaded successfully");
            setLoadingProgress(100);
            setTimeout(() => {
              setLoading(false);
            }, 500);
          };

          const handleIframeError = () => {
            console.error("Failed to load iframe");
            setLoadingError("Failed to load Potree viewer");
            setLoading(false);
          };

          iframeRef.current.onload = handleIframeLoad;
          iframeRef.current.onerror = handleIframeError;

          // Fallback timeout in case iframe doesn't trigger load event
          const fallbackTimeout = setTimeout(() => {
            if (loading) {
              console.log("Fallback: assuming iframe loaded after timeout");
              setLoadingProgress(100);
              setLoading(false);
            }
          }, 10000); // 10 second timeout

          return () => {
            clearTimeout(fallbackTimeout);
          };
        }
      } catch (err) {
        console.error("Error loading project data:", err);
        setLoadingError(`Failed to load project data: ${err instanceof Error ? err.message : "Unknown error"}`);
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [jobNumber, loading]);

  const createPotreeViewerUrl = (jobNumber: string): string => {
    // Try different potential point cloud locations
    // const potentialPaths = [
    //   `/pointclouds/${jobNumber}/metadata.json`,
    //   `/pointclouds/example/metadata.json`, // Fallback to example
    //   `/potree/examples/lion.html`, // Another fallback
    // ];

    // For now, let's use a working example from the Potree installation
    // You can modify this to point to your actual point cloud data
    const baseUrl = window.location.origin;
    
    // Check if we have a specific point cloud for this job number
    const pointCloudUrl = `${baseUrl}/pointclouds/${jobNumber}/metadata.json`;
    
    // Create the Potree viewer URL with the point cloud
    const viewerUrl = `/potree-viewer.html?pointcloud=${encodeURIComponent(pointCloudUrl)}`;
    
    return viewerUrl;
  };

  // Handle sidebar toggle
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ 
          type: "toggleSidebar",
          visible: !sidebarVisible 
        }, "*");
      } catch (error) {
        console.log("Could not send message to iframe:", error);
      }
    }
  };

  // Handle map type changes
  const handleMapTypeChange = (newMapType: typeof mapType) => {
    setMapType(newMapType);
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ 
          type: "changeMapType",
          mapType: newMapType 
        }, "*");
      } catch (error) {
        console.log("Could not send map type message to iframe:", error);
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
              <p className="text-xs text-hwc-light/60 mt-2">Fetching project data...</p>
            )}
            {loadingProgress >= 50 && loadingProgress < 100 && (
              <p className="text-xs text-hwc-light/60 mt-2">Loading Potree viewer...</p>
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
                // Retry loading
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

      {/* Potree Viewer Iframe */}
      <iframe
        ref={iframeRef}
        className="absolute inset-0 w-full h-full border-0 z-10"
        title="Potree Viewer"
        style={{ background: "#292C30" }}
        allow="fullscreen"
      />
    </>
  );
}
