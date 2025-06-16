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
import ProjectFiles from "@/components/ProjectFiles"; // Import ProjectFiles
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs

export default function ProjectViewerPage() {
  const router = useRouter();
  const { jobNumber } = router.query as { jobNumber: string };
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"viewer" | "files">("viewer");

  const potreeContainerId = "potree_render_area";
  const {
    viewer,
    loading: potreeLoading,
    error: potreeError,
    progress,
  } = usePotreeViewer(
    potreeContainerId,
    project?.pointCloudUrl || `/pointclouds/example/metadata.json` // Fallback to example if no URL
  );

  useEffect(() => {
    if (jobNumber) {
      const fetchProject = async () => {
        try {
          setLoading(true);
          // Try fetching from service, then fallback to mock data from index.tsx if not found
          let data = await projectService.getProjectByJobNumber(jobNumber);
          if (!data) {
            // Fallback to mock data logic (simplified, ideally fetch from a shared source)
            const allProjects = await projectService.getAllProjects(); // This uses mock if API fails
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
    // Here you would typically call a service to save the updated project
    // For now, it just updates the local state
    console.log("Project updated (mock):", updatedProject);
  };

  if (loading) {
    return <ViewerLoadingOverlay message="Loading project data..." />;
  }

  if (error) {
    return <ViewerErrorOverlay message={error} />;
  }

  if (!project) {
    return <ViewerErrorOverlay message="Project data could not be loaded." />;
  }

  return (
    <>
      <Head>
        <title>{project.projectName} | HWC Engineering Cloud Viewer</title>
        <meta name="description" content={`View project: ${project.projectName}`} />
        {/* Potree specific CSS files - these might be necessary for Potree to function correctly */}
        {/* It's generally better to include global styles in _app.tsx, but Potree might have specific needs */}
        <link rel="stylesheet" type="text/css" href="/potree/build/potree/potree.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/openlayers3/ol.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/spectrum/spectrum.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jstree/themes/mixed/style.css" />
      </Head>

      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Header onNewProject={() => {}} /> {/* Simplified Header for viewer page */}
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <ViewerHeader project={project} />
          
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "viewer" | "files")} className="flex-1 flex flex-col overflow-hidden p-4">
            <TabsList className="mb-4">
              <TabsTrigger value="viewer">3D Viewer</TabsTrigger>
              <TabsTrigger value="files">Files & Attachments</TabsTrigger>
            </TabsList>

            <TabsContent value="viewer" className="flex-1 flex flex-col overflow-hidden relative">
              {potreeLoading && <ViewerLoadingOverlay message={`Loading point cloud... ${progress.toFixed(0)}%`} />}
              {potreeError && <ViewerErrorOverlay message={`Potree Error: ${potreeError}`} />}
              <div id={potreeContainerId} className="flex-1 w-full h-full bg-black" />
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
