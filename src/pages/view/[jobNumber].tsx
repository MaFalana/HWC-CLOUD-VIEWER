
import { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Project } from "@/types/project";
// projectService is not directly used here anymore as usePotreeViewer handles data fetching
// import { projectService } from "@/services/projectService"; 
import ViewerHeader from "@/components/viewer/ViewerHeader";
import ViewerProjectInfoPanel from "@/components/viewer/ViewerProjectInfoPanel";
import ViewerLoadingOverlay from "@/components/viewer/ViewerLoadingOverlay";
import ViewerErrorOverlay from "@/components/viewer/ViewerErrorOverlay";
import { usePotreeViewer } from "@/hooks/usePotreeViewer";
import ProjectFiles from "@/components/ProjectFiles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// PotreeViewerInstance type for clarity, though Potree itself is 'any' for now
type PotreeViewerInstance = any; 

export default function ProjectViewerPage() {
  const router = useRouter();
  const { jobNumber } = router.query as { jobNumber: string };
  
  // State for viewer page specific UI elements
  const [activeTab, setActiveTab] = useState<"viewer" | "files">("viewer");
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

  // Local project state for components like ProjectFiles that might need to update project details
  // This will be initialized/updated based on potreeProjectData
  const [projectForFiles, setProjectForFiles] = useState<Project | null>(null);

  useEffect(() => {
    if (potreeProjectData) {
      setProjectForFiles(potreeProjectData);
    }
  }, [potreeProjectData]);

  const handleUpdateProject = useCallback((updatedProject: Project) => {
    setProjectForFiles(updatedProject);
    // If needed, you could also inform usePotreeViewer or re-fetch,
    // but for now, this updates the local state for ProjectFiles.
    console.log("Project updated in viewer page (for ProjectFiles):", updatedProject);
  }, []);

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
        <link rel="stylesheet" type="text/css" href="/potree/build/potree/potree.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/openlayers3/ol.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/spectrum/spectrum.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jstree/themes/mixed/style.css" />
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
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "viewer" | "files")} className="flex-1 flex flex-col overflow-hidden p-4">
            <TabsList className="mb-4">
              <TabsTrigger value="viewer">3D Viewer</TabsTrigger>
              <TabsTrigger value="files">Files & Attachments</TabsTrigger>
            </TabsList>

            <TabsContent value="viewer" className="flex-1 flex flex-col overflow-hidden relative">
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
            </TabsContent>

            <TabsContent value="files" className="flex-1 overflow-y-auto p-1">
              {projectForFiles ? (
                <ProjectFiles project={projectForFiles} onUpdateProject={handleUpdateProject} />
              ) : (
                <p>Loading project files information...</p> 
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
  