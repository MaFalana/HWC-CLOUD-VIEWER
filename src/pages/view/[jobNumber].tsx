import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { usePotreeViewer } from "@/hooks/usePotreeViewer";
import ViewerLoadingOverlay from "@/components/viewer/ViewerLoadingOverlay";
import ViewerErrorOverlay from "@/components/viewer/ViewerErrorOverlay";
import ViewerHeader from "@/components/viewer/ViewerHeader";
import ViewerProjectInfoPanel from "@/components/viewer/ViewerProjectInfoPanel";
import ViewerMapControls from "@/components/viewer/ViewerMapControls";

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
        <ViewerLoadingOverlay 
          projectData={projectData}
          jobNumber={jobNumber}
          loadingMessage={loadingMessage}
        />
      )}

      {loadingError && !isLoading && (
        <ViewerErrorOverlay
          loadingError={loadingError}
          onRetry={retryLoad}
        />
      )}

      {viewerInstanceReady && !isLoading && !loadingError && (
        <>
          <ViewerHeader
            projectData={projectData}
            jobNumber={jobNumber}
            customSidebarVisible={customSidebarVisible}
            onToggleCustomSidebar={toggleCustomSidebar}
            onToggleProjectInfoPanel={() => setShowProjectInfoPanel(!showProjectInfoPanel)}
          />

          {showProjectInfoPanel && (
            <ViewerProjectInfoPanel projectData={projectData} />
          )}
          
          <ViewerMapControls
            currentMapType={mapType}
            onMapTypeChange={handleMapTypeChange}
          />
        </>
      )}
    </>
  );
}
