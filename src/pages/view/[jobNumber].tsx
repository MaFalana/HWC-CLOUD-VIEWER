import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
// Project import removed as it's unused
// import { Project } from "@/types/project";
// projectService is not directly used here anymore as usePotreeViewer handles data fetching
// import { projectService } from "@/services/projectService"; 
import ViewerHeader from "@/components/viewer/ViewerHeader";
import ViewerProjectInfoPanel from "@/components/viewer/ViewerProjectInfoPanel";
import ViewerLoadingOverlay from "@/components/viewer/ViewerLoadingOverlay";
import ViewerErrorOverlay from "@/components/viewer/ViewerErrorOverlay";
import { usePotreeViewer } from "@/hooks/usePotreeViewer";
// Removed unused imports: ProjectFiles, Tabs, TabsContent, TabsList, TabsTrigger

// PotreeViewerInstance type for clarity, though Potree itself is 'any' for now
// type PotreeViewerInstance = any; // Removed unused type alias

export default function ProjectViewerPage() {
  const router = useRouter();
  const { jobNumber } = router.query as { jobNumber: string };
  
  // State for viewer page specific UI elements
  // Removed unused state: activeTab, setActiveTab
  const [customSidebarVisible, setCustomSidebarVisible] = useState(true); // Potree sidebar
  const [projectInfoPanelVisible, setProjectInfoPanelVisible] = useState(true);

  // usePotreeViewer hook now manages its own project data fetching and Potree instance
  const {
    projectData: potreeProjectData, // Renamed to avoid conflict if we re-introduce local project state
    isLoading: potreeIsLoading,
    loadingMessage: potreeLoadingMessage,
    loadingError: potreeLoadingError,
    viewerInstanceReady, // This indicates if window.viewer is set and point cloud loaded
    retryLoad: potreeRetryLoad,
  } = usePotreeViewer({ jobNumber });

  // Removed unused projectForFiles state and its useEffect
  // const [_, setProjectForFiles] = useState<Project | null>(null);
  // useEffect(() => {
  //   if (potreeProjectData) {
  //     setProjectForFiles(potreeProjectData);
  //   }
  // }, [potreeProjectData]);

  // Removed unused callback: handleUpdateProject

  const toggleCustomSidebar = () => {
    setCustomSidebarVisible(!customSidebarVisible);
    if (window.viewer && window.viewer.toggleSidebar) {
      // Potree's own sidebar toggle might be different or non-existent.
      // This is a common pattern, but might need adjustment based on Potree's API.
      // For now, we assume there's a way to control Potree's GUI visibility.
      // If Potree's sidebar is #potree_sidebar_container, we can toggle its display.
      const potreeSidebar = document.getElementById("potree_sidebar_container");
      if (potreeSidebar) {
        potreeSidebar.style.display = customSidebarVisible ? "none" : "block";
      }
    }
  };
  
  const toggleProjectInfoPanel = () => setProjectInfoPanelVisible(!projectInfoPanelVisible);

  if (potreeIsLoading && !potreeProjectData) { // Show initial loading overlay
    return (
      <ViewerLoadingOverlay
        projectData={null}
        jobNumber={jobNumber}
        loadingMessage={potreeLoadingMessage || "Loading project data..."}
      />
    );
  }

  if (potreeLoadingError && !potreeProjectData) { // Show error if project data never loaded
    return (
      <ViewerErrorOverlay
        loadingError={potreeLoadingError}
        onRetry={potreeRetryLoad}
      />
    );
  }
  
  // If potreeProjectData is null after loading and no error, it means project not found by hook
  if (!potreeProjectData) {
     return (
      <ViewerErrorOverlay
        loadingError="Project not found or could not be loaded."
        onRetry={() => router.reload()} // Or a more specific retry
      />
    );
  }

  return (
    <>
      <Head>
        <title>{potreeProjectData.projectName} | HWC Engineering Cloud Viewer</title>
        <meta name="description" content={`View project: ${potreeProjectData.projectName}`} />
        {/* Potree CSS links moved to _document.tsx */}
      </Head>

      <div className="min-h-screen bg-gray-100 flex flex-col relative">
        <ViewerHeader
          projectData={potreeProjectData}
          jobNumber={jobNumber}
          customSidebarVisible={customSidebarVisible}
          onToggleCustomSidebar={toggleCustomSidebar}
          onToggleProjectInfoPanel={toggleProjectInfoPanel}
        />
        
        <main className="flex-1 flex flex-col overflow-hidden pt-[70px]"> {/* Adjust pt for header height */}
          {/* Remove Tabs and just show the viewer directly */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {potreeIsLoading && viewerInstanceReady === false && ( // Show loading only if viewer not ready
              <ViewerLoadingOverlay
                projectData={potreeProjectData}
                jobNumber={jobNumber}
                loadingMessage={potreeLoadingMessage || "Loading point cloud..."}
              />
            )}
            {potreeLoadingError && viewerInstanceReady === false && ( // Show error if viewer not ready
               <ViewerErrorOverlay
                  loadingError={potreeLoadingError}
                  onRetry={potreeRetryLoad}
                />
            )}
            {/* Potree Render Area and Sidebar Container */}
            <div id="potree_render_area" className="flex-1 w-full h-full bg-black" />
            <div id="potree_sidebar_container" className={`potree-sidebar ${customSidebarVisible ? "" : "hidden"}`}></div>

            {viewerInstanceReady && projectInfoPanelVisible && (
              <ViewerProjectInfoPanel projectData={potreeProjectData} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
  
