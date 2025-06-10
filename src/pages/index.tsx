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
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterAndSortProjects();
  }, [projects, searchQuery, sortBy]);  // eslint-disable-line react-hooks/exhaustive-deps

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getAllProjects();
      
      // If we have real data, use it
      if (data && data.length > 0) {
        setProjects(data);
      } else {
        // Otherwise use mock data with locations for testing
        const mockProjects: Project[] = [
          {
            jobNumber: "2025-035-S",
            projectName: "Y45 Washington & Lawndale",
            clientName: "Centerpoint Energy",
            acquistionDate: "2024-12-30T16:50:40.866Z",
            description: "Comprehensive survey of the main highway bridge structure",
            status: "active" as const,
            createdAt: new Date("2024-12-30"),
            updatedAt: new Date("2024-12-30"),
            projectType: "survey",
            location: {
              latitude: 39.7684,
              longitude: -86.1581,
              address: "Washington & Lawndale, Indianapolis, IN"
            },
            crs: {
              horizontal: "EPSG:7328",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["bridge", "highway", "infrastructure"]
          },
          {
            jobNumber: "2500-033-S", 
            projectName: "Commercial Building Inspection",
            clientName: "ABC Development",
            acquistionDate: "2024-02-01T10:00:00.000Z",
            description: "Detailed inspection of commercial office complex",
            status: "completed" as const,
            createdAt: new Date("2024-02-01"),
            updatedAt: new Date("2024-02-15"),
            projectType: "inspection",
            location: {
              latitude: 39.7817,
              longitude: -86.1478,
              address: "Downtown Indianapolis, IN"
            },
            crs: {
              horizontal: "EPSG:7328",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["commercial", "building", "inspection"]
          },
          {
            jobNumber: "2023-075-A",
            projectName: "Peabody West 1",
            clientName: "Platinum Properties",
            acquistionDate: "2023-03-28T16:50:40.866Z",
            description: "Comprehensive point cloud survey of industrial facility",
            status: "completed" as const,
            createdAt: new Date("2023-03-28"),
            updatedAt: new Date("2023-03-28"),
            projectType: "survey",
            location: {
              latitude: 39.8283,
              longitude: -86.1755,
              address: "Peabody West, Indianapolis, IN"
            },
            crs: {
              horizontal: "EPSG:7328",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["industrial", "facility", "survey"]
          },
          {
            jobNumber: "2024-410-S",
            projectName: "Highway Infrastructure Survey",
            clientName: "INDOT",
            acquistionDate: "2024-10-15T14:30:00.000Z",
            description: "LiDAR survey of highway infrastructure for maintenance planning",
            status: "active" as const,
            createdAt: new Date("2024-10-15"),
            updatedAt: new Date("2024-10-15"),
            projectType: "survey",
            location: {
              latitude: 39.7392,
              longitude: -86.1652,
              address: "I-465 & US-31, Indianapolis, IN"
            },
            crs: {
              horizontal: "EPSG:7328",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["highway", "infrastructure", "lidar"]
          },
          {
            jobNumber: "2024-377-S",
            projectName: "Evansville Bridge Survey",
            clientName: "City of Evansville",
            acquistionDate: "2024-08-20T09:15:00.000Z",
            description: "Structural survey of downtown bridge using LiDAR technology",
            status: "processing" as const,
            createdAt: new Date("2024-08-20"),
            updatedAt: new Date("2024-08-20"),
            projectType: "survey",
            location: {
              latitude: 37.9747,
              longitude: -87.5558,
              address: "Downtown Evansville, IN"
            },
            crs: {
              horizontal: "EPSG:7366",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["bridge", "structural", "evansville"]
          },
          {
            jobNumber: "2024-411-S",
            projectName: "Fort Wayne Industrial Complex",
            clientName: "Industrial Partners LLC",
            acquistionDate: "2024-11-05T13:45:00.000Z",
            description: "Complete facility mapping for expansion planning",
            status: "active" as const,
            createdAt: new Date("2024-11-05"),
            updatedAt: new Date("2024-11-05"),
            projectType: "mapping",
            location: {
              latitude: 1234567.89,
              longitude: 987654.32,
              address: "Fort Wayne, IN"
            },
            crs: {
              horizontal: "EPSG:7366",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["industrial", "mapping", "fort-wayne"]
          },
          {
            jobNumber: "2024-412-S",
            projectName: "Vanderburgh County Survey",
            clientName: "County Engineering",
            acquistionDate: "2024-09-15T11:30:00.000Z",
            description: "County coordinate system survey project",
            status: "processing" as const,
            createdAt: new Date("2024-09-15"),
            updatedAt: new Date("2024-09-15"),
            projectType: "survey",
            location: {
              latitude: 1456789.12,
              longitude: 876543.21,
              address: "Evansville, IN"
            },
            crs: {
              horizontal: "EPSG:7366",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["county", "survey", "vanderburgh"]
          },
          {
            jobNumber: "2024-413-S",
            projectName: "Grant County Infrastructure",
            clientName: "City of Marion",
            acquistionDate: "2024-07-22T14:15:00.000Z",
            description: "Infrastructure mapping in Grant County coordinates",
            status: "active" as const,
            createdAt: new Date("2024-07-22"),
            updatedAt: new Date("2024-07-22"),
            projectType: "mapping",
            location: {
              latitude: 2345678.90,
              longitude: 765432.10,
              address: "Marion, IN"
            },
            crs: {
              horizontal: "EPSG:7304",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["grant", "infrastructure", "marion"]
          },
          {
            jobNumber: "2022-094-B",
            projectName: "South Bend University Campus",
            clientName: "Notre Dame University",
            acquistionDate: "2022-06-15T10:30:00.000Z",
            description: "Campus-wide LiDAR survey for facility management",
            status: "completed" as const,
            createdAt: new Date("2022-06-15"),
            updatedAt: new Date("2022-06-30"),
            projectType: "survey",
            location: {
              latitude: 41.7018,
              longitude: -86.2390,
              address: "Notre Dame, South Bend, IN"
            },
            crs: {
              horizontal: "EPSG:7300",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["campus", "university", "south-bend"]
          },
          {
            jobNumber: "2022-076-S",
            projectName: "Bloomington Downtown Corridor",
            clientName: "City of Bloomington",
            acquistionDate: "2022-05-10T09:00:00.000Z",
            description: "Urban corridor mapping for infrastructure planning",
            status: "archived" as const,
            createdAt: new Date("2022-05-10"),
            updatedAt: new Date("2022-05-25"),
            projectType: "mapping",
            location: {
              latitude: 39.1653,
              longitude: -86.5264,
              address: "Downtown Bloomington, IN"
            },
            crs: {
              horizontal: "EPSG:7338",
              vertical: "EPSG:6360",
              geoidModel: "GEOID18"
            },
            tags: ["urban", "corridor", "bloomington"]
          }
        ];
        
        setProjects(mockProjects);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortProjects = () => {
    const filtered = projects.filter(project => {
      const searchLower = searchQuery.toLowerCase();
      return (
        project.projectName.toLowerCase().includes(searchLower) ||
        project.jobNumber.toLowerCase().includes(searchLower) ||
        project.clientName?.toLowerCase().includes(searchLower) ||
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
          return (a.clientName || "").localeCompare(b.clientName || "");
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
        <title>HWC Engineering | Cloud Viewer</title>
        <meta name="description" content="Point cloud project management dashboard" />
        <link rel="icon" href="/hwc-angle-logo-16px-mbe1odp0.png" />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header
          onNewProject={handleNewProject}
          onViewChange={setCurrentView}
          currentView={currentView}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        <main className="container py-6 flex-1 overflow-auto">
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
