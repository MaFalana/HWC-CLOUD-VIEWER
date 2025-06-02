import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Menu, X, MapPin, Info } from "lucide-react";
import { Project } from "@/types/project";
import { potreeLocationService } from "@/services/potreeLocationService";

export default function PotreeViewer() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
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
        setLoadingProgress(30);

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
          console.log("No project info found, using extracted data");
        }

        // Manually set loading to false after a timeout
        // This is a workaround for the iframe communication issues
        setTimeout(() => {
          setLoadingProgress(100);
          setLoading(false);
        }, 5000);

        // Load the iframe with the Potree viewer
        if (iframeRef.current) {
          const latitude = projectData.location?.latitude || 39.7684;
          const longitude = projectData.location?.longitude || -86.1581;
          
          // Load the Potree viewer directly
          iframeRef.current.src = `/potree-viewer.html?jobNumber=${jobNumber}&mapType=${mapType}&latitude=${latitude}&longitude=${longitude}&projectName=${encodeURIComponent(projectData.projectName || "")}`;
        }
      } catch (err) {
        console.error("Error loading project data:", err);
        setLoadingError(`Failed to load project data: ${err instanceof Error ? err.message : "Unknown error"}`);
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [jobNumber]);

  // Update map type when it changes
  useEffect(() => {
    if (!loading && iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: "setMapType", mapType }, "*");
      } catch (error) {
        console.error("Error sending message to iframe:", error);
      }
    }
  }, [mapType, loading]);

  // Handle sidebar toggle
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
    if (!loading && iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: "toggleSidebar" }, "*");
      } catch (error) {
        console.error("Error sending message to iframe:", error);
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
