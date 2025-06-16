import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Project } from "@/types/project";
import { projectService } from "@/services/projectService";
// Header import removed as it's unused
import ProjectFiles from "@/components/ProjectFiles";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function ProjectFilesPage() {
  const router = useRouter();
  const { jobNumber } = router.query as { jobNumber?: string };
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadProject = async () => {
      if (!jobNumber) {
        setError("Job number is missing.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        // Attempt to find the project in the mock data first
        const allProjects = await projectService.getAllProjects(); // This typically returns mock data
        const foundProject = allProjects.find(p => p.jobNumber === jobNumber);

        if (foundProject) {
          setProject(foundProject);
        } else {
          // Fallback to trying to get a single project if not in mock list (might be useful for future API)
          const data = await projectService.getProject(jobNumber);
          if (data) {
            setProject(data);
          } else {
            setError(`Project with job number "${jobNumber}" not found.`);
          }
        }
      } catch (err) {
        console.error("Failed to load project:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred while fetching project data.");
        toast({
          title: "Error",
          description: "Failed to load project data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (router.isReady) {
      loadProject();
    }
  }, [jobNumber, router.isReady, toast]);

  const handleUpdateProject = (updatedProject: Project) => {
    // For now, just update local state as we are using mock data
    // In a real app, this would call projectService.updateProject
    setProject(updatedProject);
    toast({
      title: "Project Updated (Locally)",
      description: "Project file information has been updated in the current view.",
    });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-hwc-red mb-4" />
          <p className="text-gray-600">Loading project files...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-red-600 mb-2">Error Loading Project</h3>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      );
    }

    if (!project) {
      return (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Project Not Found</h3>
          <p className="text-gray-500 mb-4">
            The project you are looking for could not be found.
          </p>
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      );
    }

    return (
      <ProjectFiles project={project} onUpdateProject={handleUpdateProject} />
    );
  };

  return (
    <>
      <Head>
        <title>
          {project ? `Files for ${project.projectName}` : "Project Files"} | HWC Engineering
        </title>
        <meta name="description" content={`Manage files for project ${project?.projectName || jobNumber}`} />
        <link rel="icon" href="/hwc-angle-logo-16px-mbe1odp0.png" />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* 
          The main dashboard Header is complex and includes search/sort/view controls
          not relevant here. A simpler header might be better, or reuse parts of it.
          For now, let's use a simplified version or placeholder.
        */}
        <header className="bg-hwc-dark text-white shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/")}
                  className="text-white hover:bg-hwc-red/20 font-medium"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                <h1 className="text-xl font-semibold">
                  {project ? `Files: ${project.projectName}` : "Project Files"}
                </h1>
              </div>
              {project && <span className="text-sm text-gray-400">Job #: {project.jobNumber}</span>}
            </div>
          </div>
        </header>
        
        <main className="container mx-auto py-6 px-4 md:px-6 lg:px-8 flex-1">
          {project && (
            <div className="mb-6 p-4 bg-white rounded-lg shadow">
              <h2 className="text-2xl font-semibold text-hwc-dark mb-1">{project.projectName}</h2>
              <p className="text-sm text-gray-500 font-mono mb-3">Job Number: {project.jobNumber}</p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {project.clientName && (
                  <span>Client: <span className="font-medium">{project.clientName}</span></span>
                )}
                {project.projectType && (
                  <span>Type: <span className="font-medium capitalize">{project.projectType}</span></span>
                )}
                {project.acquistionDate && (
                  <span>
                    Acquired: <span className="font-medium">
                      {new Date(project.acquistionDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC", // Ensure UTC display
                      })}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
          {renderContent()}
        </main>
      </div>
    </>
  );
}
