
import { useState, useEffect } from "react";
import Head from "next/head";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import ProjectList from "@/components/ProjectList";
import ProjectMap from "@/components/ProjectMap";
import ProjectModal from "@/components/ProjectModal";
import { Project, CreateProjectData } from "@/types/project";
import { projectService } from "@/services/projectService";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<"card" | "list" | "map">("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    filterAndSortProjects();
  }, [projects, searchQuery, sortBy]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getAllProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects. Please try again.",
        variant: "destructive",
      });
      // Mock data for development
      setProjects([
        {
          jobNumber: "2024-001",
          projectName: "Highway Bridge Survey",
          description: "Comprehensive survey of the main highway bridge structure",
          status: "active",
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-15"),
          client: "State DOT",
          projectType: "survey",
          location: {
            latitude: 39.7684,
            longitude: -86.1581,
            address: "Indianapolis, IN"
          },
          tags: ["bridge", "highway", "infrastructure"],
          thumbnailUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400"
        },
        {
          jobNumber: "2024-002", 
          projectName: "Commercial Building Inspection",
          description: "Detailed inspection of commercial office complex",
          status: "completed",
          createdAt: new Date("2024-02-01"),
          updatedAt: new Date("2024-02-15"),
          client: "ABC Development",
          projectType: "inspection",
          location: {
            latitude: 39.7817,
            longitude: -86.1478,
            address: "Downtown Indianapolis, IN"
          },
          tags: ["commercial", "building", "inspection"]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortProjects = () => {
    let filtered = projects.filter(project => {
      const searchLower = searchQuery.toLowerCase();
      return (
        project.projectName.toLowerCase().includes(searchLower) ||
        project.jobNumber.toLowerCase().includes(searchLower) ||
        project.client?.toLowerCase().includes(searchLower) ||
        project.description?.toLowerCase().includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.projectName.localeCompare(b.projectName);
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "status":
          return a.status.localeCompare(b.status);
        case "client":
          return (a.client || "").localeCompare(b.client || "");
        default:
          return 0;
      }
    });

    setFilteredProjects(filtered);
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleDeleteProject = async (jobNumber: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      await projectService.deleteProject(jobNumber);
      setProjects(prev => prev.filter(p => p.jobNumber !== jobNumber));
      toast({
        title: "Success",
        description: "Project deleted successfully.",
      });
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmitProject = async (data: CreateProjectData) => {
    try {
      if (modalMode === "create") {
        const newProject = await projectService.createProject(data);
        setProjects(prev => [newProject, ...prev]);
        toast({
          title: "Success",
          description: "Project created successfully.",
        });
      } else if (editingProject) {
        const updatedProject = await projectService.updateProject(editingProject.jobNumber, data);
        setProjects(prev => prev.map(p => 
          p.jobNumber === editingProject.jobNumber ? updatedProject : p
        ));
        toast({
          title: "Success",
          description: "Project updated successfully.",
        });
      }
    } catch (error) {
      console.error("Failed to save project:", error);
      toast({
        title: "Error",
        description: "Failed to save project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hwc-red mx-auto mb-4"></div>
            <p className="text-gray-600">Loading projects...</p>
          </div>
        </div>
      );
    }

    if (filteredProjects.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery ? "Try adjusting your search criteria" : "Get started by creating your first project"}
          </p>
        </div>
      );
    }

    switch (currentView) {
      case "list":
        return (
          <ProjectList
            projects={filteredProjects}
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
          />
        );
      case "map":
        return (
          <ProjectMap
            projects={filteredProjects}
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
          />
        );
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.jobNumber}
                project={project}
                onEdit={handleEditProject}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <>
      <Head>
        <title>HWC Cloud Viewer - Dashboard</title>
        <meta name="description" content="Point cloud project management dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <Header
          onNewProject={handleNewProject}
          onViewChange={setCurrentView}
          currentView={currentView}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        <main className="container py-6">
          {renderContent()}
        </main>

        <ProjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmitProject}
          project={editingProject}
          mode={modalMode}
        />
      </div>
    </>
  );
}
