import { Project, CreateProjectData } from "@/types/project";
import { locationService } from "@/services/locationService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hwc-backend-server.vercel.app";

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
    parsed?: Record<string, unknown>;
  };
  worldFile?: {
    content: string;
    parsed?: Record<string, unknown>;
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
    const response = await fetch(`${API_BASE_URL}/view`, {
  method: 'GET',
  credentials: 'include' // or 'same-origin' if using cookies
});

    
    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }
    const data = await response.json() as RawProjectData[];
    
    // Transform the data and ensure CRS is properly handled
    const projects = data.map((project: RawProjectData) => {
      // Ensure CRS is properly mapped
      const crs = project.crs ? {
        horizontal: project.crs.horizontal || "",
        vertical: project.crs.vertical || "",
        geoidModel: project.crs.geoidModel || ""
      } : {
        horizontal: "",
        vertical: "",
        geoidModel: ""
      };

      // Handle location - use existing location or derive from CRS
      let location = project.location;
      
      // If no location or invalid location, try to derive from CRS
      if (!location) 
      {
        const derivedLocation = locationService.deriveLocationFromProject({ crs });
        if (derivedLocation) 
        {
          location = derivedLocation;
        }
      }

      const transformedProject: Project = {
        ...project,
        createdAt: project.acquistionDate ? new Date(project.acquistionDate.split('TypeError')[0]) : new Date(),
        updatedAt: project.acquistionDate ? new Date(project.acquistionDate.split('TypeError')[0]) : new Date(),
        crs,
        location
      };

      console.log(`Project ${project.jobNumber} loaded with CRS:`, transformedProject.crs);
      console.log(`Project ${project.jobNumber} location:`, transformedProject.location);
      
      return transformedProject;
    });
    
    return projects;
  },

  async getProject(jobNumber: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/view/${jobNumber}`);
    if (!response.ok) {
      throw new Error("Failed to fetch project");
    }
    const data = await response.json() as RawProjectData;
    
    // Transform the data to ensure proper date handling and CRS mapping
    const project: Project = {
      ...data,
      createdAt: data.acquistionDate ? new Date(data.acquistionDate.split('TypeError')[0]) : new Date(),
      updatedAt: data.acquistionDate ? new Date(data.acquistionDate.split('TypeError')[0]) : new Date(),
      // Ensure CRS is properly mapped - check if it exists and has values
      crs: data.crs ? {
        horizontal: data.crs.horizontal || "",
        vertical: data.crs.vertical || "",
        geoidModel: data.crs.geoidModel || ""
      } : {
        horizontal: "",
        vertical: "",
        geoidModel: ""
      }
    };

    console.log(`Project ${jobNumber} loaded with CRS:`, project.crs);

    return project;
  },

  async createProject(projectData: CreateProjectData): Promise<Project> {
    try {
      // Validate required fields
      if (!projectData.jobNumber || !projectData.projectName) {
        throw new Error('Job number and project name are required');
      }

      // Create project with CRS data
      const project: Project = {
        jobNumber: projectData.jobNumber,
        projectName: projectData.projectName,
        description: projectData.description || "",
        clientName: projectData.clientName || "",
        acquistionDate: projectData.acquistionDate || new Date().toISOString(),
        projectType: projectData.projectType || "survey",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        location: projectData.location || {
          latitude: 0,
          longitude: 0,
          address: ""
        },
        crs: projectData.crs || {
          horizontal: "",
          vertical: "",
          geoidModel: ""
        },
        tags: projectData.tags || [],
        thumbnailUrl: projectData.thumbnailUrl
      };

      // Log the CRS data being sent
      console.log('Creating project with CRS data:', {
        jobNumber: project.jobNumber,
        crs: project.crs
      });

      // Save to MongoDB via API
      const response = await fetch(`${API_BASE_URL}/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(project),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create project: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to create project: ${response.statusText}`);
      }

      const savedProject = await response.json();
      console.log('Project created successfully:', savedProject);
      
      return {
        ...savedProject,
        createdAt: new Date(savedProject.createdAt || project.createdAt),
        updatedAt: new Date(savedProject.updatedAt || project.updatedAt)
      };
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  },

  async updateProject(jobNumber: string, projectData: CreateProjectData): Promise<Project> {
    try {
      // Validate required fields
      if (!projectData.projectName) {
        throw new Error('Project name is required');
      }

      // Get the existing project to preserve data that shouldn't be overwritten
      const existingProject = await this.getProject(jobNumber);

      // Update project with CRS data
      const updatedProject: Project = {
        ...existingProject,
        jobNumber: jobNumber,
        projectName: projectData.projectName,
        description: projectData.description || existingProject.description || "",
        clientName: projectData.clientName || existingProject.clientName || "",
        acquistionDate: projectData.acquistionDate || existingProject.acquistionDate || new Date().toISOString(),
        projectType: projectData.projectType || existingProject.projectType || "survey",
        status: existingProject.status || "active",
        createdAt: existingProject.createdAt || new Date(),
        updatedAt: new Date(),
        location: projectData.location || existingProject.location || {
          latitude: 0,
          longitude: 0,
          address: ""
        },
        crs: projectData.crs || existingProject.crs || {
          horizontal: "",
          vertical: "",
          geoidModel: ""
        },
        tags: projectData.tags || existingProject.tags || [],
        thumbnailUrl: projectData.thumbnailUrl || existingProject.thumbnailUrl
      };

      // Log the CRS data being sent
      console.log('Updating project with CRS data:', {
        jobNumber: updatedProject.jobNumber,
        crs: updatedProject.crs
      });

      // Update in MongoDB via API
      const response = await fetch(`${API_BASE_URL}/view/${jobNumber}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedProject),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to update project: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to update project: ${response.statusText}`);
      }

      const savedProject = await response.json();
      console.log('Project updated successfully:', savedProject);
      
      return {
        ...savedProject,
        createdAt: new Date(savedProject.createdAt || updatedProject.createdAt),
        updatedAt: new Date(savedProject.updatedAt || updatedProject.updatedAt)
      };
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
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

  /**
   * Update project files (prj/tfw) in the database
   */
  async updateProjectFiles(jobNumber: string, fileData: {
    projFile?: { content: string; parsed?: Record<string, unknown> };
    worldFile?: { content: string; parsed?: Record<string, unknown> };
  }): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/view/${jobNumber}/files`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fileData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update project files");
      }
    } catch (error) {
      console.error(`Error updating project files for ${jobNumber}:`, error);
      throw error;
    }
  },
};
