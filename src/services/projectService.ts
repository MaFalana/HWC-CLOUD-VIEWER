
import { Project, CreateProjectData } from "@/types/project";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4400";

export const projectService = {
  async getAllProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/view`);
    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }
    return response.json();
  },

  async getProject(jobNumber: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/view/${jobNumber}`);
    if (!response.ok) {
      throw new Error("Failed to fetch project");
    }
    return response.json();
  },

  async createProject(projectData: CreateProjectData): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(projectData),
    });
    if (!response.ok) {
      throw new Error("Failed to create project");
    }
    return response.json();
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
    return response.json();
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
