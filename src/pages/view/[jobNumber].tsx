import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Menu, X, MapPin, Info, RefreshCw } from "lucide-react";
import { usePotreeViewer } from "@/hooks/usePotreeViewer";
import "@/styles/potree-viewer.css"; // Import the Potree viewer styles

export default function PotreeViewerPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const {
    projectData,
    isLoading,
    loadingMessage,
    loadingError,
    viewerInstanceReady,
    retryLoad,
  } = usePotreeViewer({ jobNumber });
  
  const [mapType, setMapType] = useState<"default" | "terrain" | "satellite" | "openstreet">("default");
  const [customSidebarVisible, setCustomSidebarVisible] = useState(true); 
  const [showProjectInfoPanel, setShowProjectInfoPanel] = useState(false);

  const toggleCustomSidebar = () => {
    setCustomSidebarVisible(prev => {
      const newVisibility = !prev;
      const sidebarEl = document.getElementById("potree_sidebar_container");
      if (sidebarEl) {
          sidebarEl.style.display = newVisibility ? "block" : "none";
      }
      // If Potree's internal sidebar toggle is desired, it would be called here:
      // if (window.viewer && typeof window.viewer.toggleSidebar === 'function') {
      //   window.viewer.toggleSidebar();
      // }
      return newVisibility;
    });
  };

  const handleMapTypeChange = (newMapType: "default" | "terrain" | "satellite" | "openstreet") => {
    setMapType(newMapType);
    if (window.viewer && window.viewer.mapView && typeof window.viewer.mapView.setMapType === "function") {
      try {
        window.viewer.mapView.setMapType(newMapType);
        console.log("Map type set to:", newMapType);
      } catch (error) {
        console.error("Could not change map type:", error);
      }
    } else {
      console.warn("Viewer or map view not available for map type change.");
    }
  };

  const handleRetry = () => {
    // Reset relevant states before retrying
    // setLoadingError(null); // This is handled within the hook
    // setIsLoading(true); // This is handled within the hook
    // setLoadingMessage("Retrying initialization..."); // This is handled within the hook
    // setViewerInstanceReady(false); // This is handled within the hook
    retryLoad();
  };

  return (
    <>
      <Head>
        <title>{projectData?.projectName || (jobNumber ? `Project ${jobNumber}` : "Potree Viewer")} - HWC Engineering</title>
        <meta name="description" content="HWC Engineering Point Cloud Viewer" />
        <link rel="icon" href="/hwc-angle-logo-16px-mbe1odp0.png" />
        {/* Potree specific CSS files, loaded directly as they are external */}
        <link rel="stylesheet" type="text/css" href="/potree/build/potree/potree.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/openlayers3/ol.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/spectrum/spectrum.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jstree/themes/mixed/style.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/Cesium/Widgets/CesiumWidget/CesiumWidget.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css" />
      </Head>

      {/* Potree containers - always rendered for Potree to attach to */}
      <div className="potree_outer_container">
        <div id="potree_render_area" />
        <div id="potree_sidebar_container" style={{ display: customSidebarVisible ? "block" : "none" }} />
      </div>

      {isLoading && (
        <div className="viewer-overlay">
          <div className="text-center">
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
              {projectData?.projectName || (jobNumber ? `Project ${jobNumber}`: "Loading Project...")}
            </h1>
            <div className="w-80 mx-auto">
              {/* Optional: Progress bar can be added here if loadingProgress is exposed from hook */}
              <p className="text-hwc-light">{loadingMessage}</p>
            </div>
            <div className="mt-8 text-sm text-hwc-light">
              Powered by HWC Engineering
            </div>
          </div>
        </div>
      )}

      {loadingError && !isLoading && (
         <div className="viewer-overlay">
          <div className="text-center">
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
            <div className="space-x-3">
              <Button
                onClick={handleRetry}
                className="bg-hwc-red hover:bg-hwc-red/90"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
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
      )}

      {viewerInstanceReady && !isLoading && !loadingError && (
        <>
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
                  {projectData?.projectName || `Project ${jobNumber}`}
                </h1>
                {projectData?.location && (
                  <div className="flex items-center gap-2 text-sm text-hwc-light/80">
                    <MapPin className="h-3 w-3" />
                    <span className="font-mono">
                      {typeof projectData.location.latitude === "number" ? projectData.location.latitude.toFixed(4) : projectData.location.latitude}, 
                      {typeof projectData.location.longitude === "number" ? projectData.location.longitude.toFixed(4) : projectData.location.longitude}
                      {projectData.location.source && (
                        <span className="ml-2 text-xs opacity-60 bg-hwc-gray/20 px-2 py-1 rounded">
                          {projectData.location.source}
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
                  onClick={() => setShowProjectInfoPanel(!showProjectInfoPanel)}
                  className="text-white hover:bg-hwc-red/20"
                  title="Project Information"
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleCustomSidebar}
                  className="text-white hover:bg-hwc-red/20"
                  title={customSidebarVisible ? "Hide Potree Sidebar" : "Show Potree Sidebar"}
                >
                  {customSidebarVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
          {showProjectInfoPanel && projectData && (
            <div className="absolute top-20 right-6 z-40 w-96">
              <Card className="bg-hwc-dark/95 backdrop-blur-md border border-hwc-red/20 text-white">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 text-lg">Project Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-hwc-light">Job Number:</span>
                      <span className="font-mono">{projectData.jobNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-hwc-light">Project Name:</span>
                      <span className="font-medium">{projectData.projectName}</span>
                    </div>
                    {projectData.clientName && (
                      <div className="flex justify-between">
                        <span className="text-hwc-light">Client:</span>
                        <span>{projectData.clientName}</span>
                      </div>
                    )}
                    {projectData.description && (
                      <div>
                        <span className="text-hwc-light">Description:</span>
                        <p className="mt-1 text-xs leading-relaxed">{projectData.description}</p>
                      </div>
                    )}
                    {projectData.location && (
                      <div>
                        <span className="text-hwc-light">Location:</span>
                        <div className="mt-1 text-xs font-mono space-y-1">
                          <div>Lat: {typeof projectData.location.latitude === "number" ? projectData.location.latitude.toFixed(6) : projectData.location.latitude}</div>
                          <div>Lon: {typeof projectData.location.longitude === "number" ? projectData.location.longitude.toFixed(6) : projectData.location.longitude}</div>
                          {projectData.location.address && <div>Address: {projectData.location.address}</div>}
                          {projectData.location.source && (
                            <div className="text-hwc-light/60">
                              Source: {projectData.location.source} 
                              {projectData.location.confidence && ` (${projectData.location.confidence})`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {projectData.crs && (
                      <div>
                        <span className="text-hwc-light">Coordinate System:</span>
                        <div className="mt-1 text-xs space-y-1">
                          <div>Horizontal: <span className="font-mono">{projectData.crs.horizontal}</span></div>
                          {projectData.crs.vertical && <div>Vertical: <span className="font-mono">{projectData.crs.vertical}</span></div>}
                          {projectData.crs.geoidModel && <div>Geoid: <span className="font-mono">{projectData.crs.geoidModel}</span></div>}
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
                  {(["default", "terrain", "satellite", "openstreet"] as const).map((type) => (
                    <Button
                      key={type}
                      variant={mapType === type ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleMapTypeChange(type)}
                      className={`text-xs h-9 ${mapType === type ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}