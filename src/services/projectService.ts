import { Project, CreateProjectData } from "@/types/project";
import { projFileService, ProjFileData } from "./projFileService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4400";

// Define a type for the raw project data from the API
interface RawProjectData {
  _id?: string;
  jobNumber: string;
  projectName: string;
  clientName?: string;
  acquistionDate: string;
  description?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  crs?: {
    horizontal: string;
    vertical?: string;
    geoidModel?: string;
  };
  projFile?: {
    content: string;
    parsed?: ProjFileData;
  };
  status: "active" | "completed" | "archived" | "processing";
  thumbnailUrl?: string;
  orthoImageUrl?: string;
  pointCloudUrl?: string;
  tags?: string[];
  projectType?: string;
}

export const projectService = {
  async getAllProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/view`);
    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }
    const data = await response.json() as RawProjectData[];
    
    // Transform the data and try to fetch .proj files for each project
    const projects = await Promise.all(data.map(async (project: RawProjectData) => {
      const transformedProject: Project = {
        ...project,
        createdAt: project.acquistionDate ? new Date(project.acquistionDate.split('TypeError')[0]) : new Date(),
        updatedAt: project.acquistionDate ? new Date(project.acquistionDate.split('TypeError')[0]) : new Date(),
      };

      // Try to fetch and parse .prj file
      try {
        const projData = await projFileService.fetchProjFile(project.jobNumber);
        if (projData) {
          transformedProject.projFile = {
            content: '', // We don't store the raw content in the response
            parsed: projData
          };

          // If no CRS is set, try to derive it from .prj file
          if (!transformedProject.crs || !transformedProject.crs.horizontal) {
            transformedProject.crs = projFileService.projDataToCRS(projData);
          }

          // If no location is set, try to derive it from .prj file
          if (!transformedProject.location || (!transformedProject.location.latitude && !transformedProject.location.longitude)) {
            const projLocation = projFileService.getLocationFromProj(projData);
            if (projLocation && projLocation.latitude && projLocation.longitude) {
              transformedProject.location = {
                latitude: projLocation.latitude,
                longitude: projLocation.longitude,
                address: transformedProject.location?.address || ''
              };
            }
          }
        }
      } catch (error) {
        console.log(`No .prj file found for project ${project.jobNumber}:`, error);
      }

      return transformedProject;
    }));
    
    return projects;
  },

  async getProject(jobNumber: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/view/${jobNumber}`);
    if (!response.ok) {
      throw new Error("Failed to fetch project");
    }
    const data = await response.json() as RawProjectData;
    
    // Transform the data to ensure proper date handling
    const project: Project = {
      ...data,
      createdAt: data.acquistionDate ? new Date(data.acquistionDate.split('TypeError')[0]) : new Date(),
      updatedAt: data.acquistionDate ? new Date(data.acquistionDate.split('TypeError')[0]) : new Date(),
    };

    // Try to fetch and parse .prj file
    try {
      const projData = await projFileService.fetchProjFile(jobNumber);
      if (projData) {
        project.projFile = {
          content: '', // We don't store the raw content in the response
          parsed: projData
        };

        // If no CRS is set, try to derive it from .prj file
        if (!project.crs || !project.crs.horizontal) {
          project.crs = projFileService.projDataToCRS(projData);
        }

        // If no location is set, try to derive it from .prj file
        if (!project.location || (!project.location.latitude && !project.location.longitude)) {
          const projLocation = projFileService.getLocationFromProj(projData);
          if (projLocation && projLocation.latitude && projLocation.longitude) {
            project.location = {
              latitude: projLocation.latitude,
              longitude: projLocation.longitude,
              address: project.location?.address || ''
            };
          }
        }
      }
    } catch (error) {
      console.log(`No .prj file found for project ${jobNumber}:`, error);
    }

    return project;
  },

  async createProject(projectData: CreateProjectData): Promise<Project> {
    const payload = {
      ...projectData,
      acquistionDate: new Date().toISOString(),
    };
    
    const response = await fetch(`${API_BASE_URL}/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Failed to create project");
    }
    const data = await response.json() as RawProjectData;
    
    return {
      ...data,
      createdAt: new Date(data.acquistionDate || new Date()),
      updatedAt: new Date(data.acquistionDate || new Date()),
      // Remove client mapping as it's not in the Project interface
    };
  },

  async updateProject(jobNumber: string, projectData: Partial<Project>): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/view/${jobNumber}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(projectData),
    });
    if (!response.ok) {
      throw new Error("Failed to update project");
    }
    const data = await response.json() as RawProjectData;
    
    return {
      ...data,
      createdAt: new Date(data.acquistionDate || new Date()),
      updatedAt: new Date(data.acquistionDate || new Date()),
      // Remove client mapping as it's not in the Project interface
    };
  },

  async deleteProject(jobNumber: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/view/${jobNumber}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete project");
    }
  },

  async getProjectFiles(jobNumber: string): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/pointclouds/${jobNumber}`);
    if (!response.ok) {
      throw new Error("Failed to fetch project files");
    }
    return response.json();
  },
};
