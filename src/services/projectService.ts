import { Project, CreateProjectData } from "@/types/project";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4400";

export const projectService = {
  async getAllProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/view`);
    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }
    const data = await response.json();
    
    // Transform the data to ensure proper date handling
    return data.map((project: any) => ({
      ...project,
      createdAt: project.acquistionDate ? new Date(project.acquistionDate.split('TypeError')[0]) : new Date(),
      updatedAt: project.acquistionDate ? new Date(project.acquistionDate.split('TypeError')[0]) : new Date(),
      client: project.clientName, // Map clientName to client for backward compatibility
    }));
  },

  async getProject(jobNumber: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/view/${jobNumber}`);
    if (!response.ok) {
      throw new Error("Failed to fetch project");
    }
    const data = await response.json();
    
    // Transform the data to ensure proper date handling
    return {
      ...data,
      createdAt: data.acquistionDate ? new Date(data.acquistionDate.split('TypeError')[0]) : new Date(),
      updatedAt: data.acquistionDate ? new Date(data.acquistionDate.split('TypeError')[0]) : new Date(),
      client: data.clientName, // Map clientName to client for backward compatibility
    };
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
    const data = await response.json();
    
    return {
      ...data,
      createdAt: new Date(data.acquistionDate || new Date()),
      updatedAt: new Date(data.acquistionDate || new Date()),
      client: data.clientName,
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
    const data = await response.json();
    
    return {
      ...data,
      createdAt: new Date(data.acquistionDate || new Date()),
      updatedAt: new Date(data.acquistionDate || new Date()),
      client: data.clientName,
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
