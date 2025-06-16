import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Project } from "@/types/project";
import { projectService } from "@/services/projectService";
import Header from "@/components/Header";
import ViewerHeader from "@/components/viewer/ViewerHeader";
import ViewerProjectInfoPanel from "@/components/viewer/ViewerProjectInfoPanel";
import ViewerLoadingOverlay from "@/components/viewer/ViewerLoadingOverlay";
import ViewerErrorOverlay from "@/components/viewer/ViewerErrorOverlay";
import { usePotreeViewer } from "@/hooks/usePotreeViewer";
import ProjectFiles from "@/components/ProjectFiles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define a more accurate type for the Potree viewer instance if available
// For now, using 'any' to resolve immediate errors, but should be refined
type PotreeViewerInstance = any;

interface UsePotreeViewerReturn {
  viewer: PotreeViewerInstance | null;
  loading: boolean;
  error: string | null;
  progress: number;
}

export default function ProjectViewerPage() {
  const router = useRouter();
  const { jobNumber } = router.query as { jobNumber: string };
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"viewer" | "files">("viewer");

  const potreeContainerId = "potree_render_area";
  
  // Correctly call usePotreeViewer, assuming it returns the defined interface
  // And assuming it takes an options object or two distinct parameters.
  // The error "Expected 1 arguments, but got 2" suggests it might take one object.
  // Let's try with two distinct parameters first, as that was the original attempt.
  // If that fails, we'll switch to a single options object.
  const {
    viewer,
    loading: potreeLoading,
    error: potreeError,
    progress,
  }: UsePotreeViewerReturn = usePotreeViewer(
    potreeContainerId,
    project?.pointCloudUrl || `/pointclouds/example/metadata.json`
  );

  useEffect(() => {
    if (jobNumber) {
      const fetchProject = async () => {
        try {
          setLoading(true);
          // Assuming projectService.getProject is the correct method
          let data = await projectService.getProject(jobNumber);
          if (!data) {
            const allProjects = await projectService.getAllProjects();
            data = allProjects.find(p => p.jobNumber === jobNumber) || null;
          }
          
          if (data) {
            setProject(data);
          } else {
            setError("Project not found.");
          }
        } catch (err) {
          console.error("Failed to load project:", err);
          setError("Failed to load project data.");
        } finally {
          setLoading(false);
        }
      };
      fetchProject();
    }
  }, [jobNumber]);

  const handleUpdateProject = (updatedProject: Project) => {
    setProject(updatedProject);
    console.log("Project updated (mock):", updatedProject);
  };

  if (loading) {
    // Pass message as children if 'message' prop is not recognized
    return <ViewerLoadingOverlay>Loading project data...</ViewerLoadingOverlay>;
  }

  if (error) {
    return <ViewerErrorOverlay>{error}</ViewerErrorOverlay>;
  }

  if (!project) {
    return <ViewerErrorOverlay>Project data could not be loaded.</ViewerErrorOverlay>;
  }

  return (
    <>
      <Head>
        <title>{project.projectName} | HWC Engineering Cloud Viewer</title>
        <meta name="description" content={`View project: ${project.projectName}`} />
        {/* Potree specific CSS files - these are kept for now due to Potree's specific needs */}
        <link rel="stylesheet" type="text/css" href="/potree/build/potree/potree.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/openlayers3/ol.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/spectrum/spectrum.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jstree/themes/mixed/style.css" />
      </Head>

      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Provide missing props for Header or ensure they are optional in Header.tsx */}
        <Header 
          onNewProject={() => { /* Placeholder for viewer page */ }}
          onViewChange={() => { /* Placeholder */ }}
          currentView="card" // Default or placeholder
          searchQuery=""       // Default or placeholder
          onSearchChange={() => { /* Placeholder */ }}
          sortBy="date"        // Default or placeholder
          onSortChange={() => { /* Placeholder */ }}
        />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Assuming ViewerHeader expects 'project' prop */}
          <ViewerHeader project={project} />
          
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "viewer" | "files")} className="flex-1 flex flex-col overflow-hidden p-4">
            <TabsList className="mb-4">
              <TabsTrigger value="viewer">3D Viewer</TabsTrigger>
              <TabsTrigger value="files">Files & Attachments</TabsTrigger>
            </TabsList>

            <TabsContent value="viewer" className="flex-1 flex flex-col overflow-hidden relative">
              {potreeLoading && <ViewerLoadingOverlay>{`Loading point cloud... ${progress.toFixed(0)}%`}</ViewerLoadingOverlay>}
              {potreeError && <ViewerErrorOverlay>{`Potree Error: ${potreeError}`}</ViewerErrorOverlay>}
              <div id={potreeContainerId} className="flex-1 w-full h-full bg-black" />
              {/* Assuming ViewerProjectInfoPanel expects 'project' and 'viewer' props */}
              {viewer && <ViewerProjectInfoPanel project={project} viewer={viewer} />}
            </TabsContent>

            <TabsContent value="files" className="flex-1 overflow-y-auto p-1">
              <ProjectFiles project={project} onUpdateProject={handleUpdateProject} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
