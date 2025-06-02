import { Project, CreateProjectData } from "@/types/project";
import { projFileService, ProjFileData } from "./projFileService";
import { worldFileService, WorldFileData } from "./worldFileService";

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
  worldFile?: {
    content: string;
    parsed?: WorldFileData;
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

      // Try to fetch and parse .prj and .tfw files
      try {
        const [projData, worldData] = await Promise.all([
          projFileService.fetchProjFile(project.jobNumber),
          worldFileService.fetchWorldFile(project.jobNumber)
        ]);

        if (projData) {
          transformedProject.projFile = {
            content: '', // We don't store the raw content in the response
            parsed: projData
          };

          // If no CRS is set, try to derive it from .prj file
          if (!transformedProject.crs || !transformedProject.crs.horizontal) {
            transformedProject.crs = projFileService.projDataToCRS(projData);
          }
        }

        if (worldData) {
          transformedProject.worldFile = {
            content: '', // We don't store the raw content in the response
            parsed: worldData
          };
        }

        // If no location is set, try to derive it from .prj or .tfw files
        if (!transformedProject.location || (!transformedProject.location.latitude && !transformedProject.location.longitude)) {
          let derivedLocation = null;

          // Try world file first (usually more accurate for location)
          if (worldData) {
            // Use EPSG code from .prj file if available for accurate projection
            const spatialRef = projData?.epsgCode ? projData.epsgCode.replace('EPSG:', '') : undefined;
            derivedLocation = await worldFileService.worldFileToGeographic(worldData, spatialRef);
            if (!derivedLocation) {
              // Try center point calculation
              derivedLocation = await worldFileService.getCenterPoint(worldData, spatialRef);
            }
          }

          // Fall back to .prj file if world file didn't work
          if (!derivedLocation && projData) {
            derivedLocation = await projFileService.getLocationFromProj(projData);
          }

          if (derivedLocation && derivedLocation.latitude && derivedLocation.longitude) {
            transformedProject.location = {
              latitude: derivedLocation.latitude,
              longitude: derivedLocation.longitude,
              address: transformedProject.location?.address || ''
            };
          }
        }

        // Store the file data in MongoDB if we found any
        if (projData || worldData) {
          try {
            await this.updateProjectFiles(project.jobNumber, {
              projFile: projData ? {
                content: '', // Could store actual content here if needed
                parsed: projData
              } : undefined,
              worldFile: worldData ? {
                content: '', // Could store actual content here if needed
                parsed: worldData
              } : undefined
            });
          } catch (updateError) {
            console.log(`Failed to update project files in database for ${project.jobNumber}:`, updateError);
          }
        }
      } catch (error) {
        console.log(`No .prj or .tfw files found for project ${project.jobNumber}:`, error);
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

    // Try to fetch and parse .prj and .tfw files
    try {
      const [projData, worldData] = await Promise.all([
        projFileService.fetchProjFile(jobNumber),
        worldFileService.fetchWorldFile(jobNumber)
      ]);

      if (projData) {
        project.projFile = {
          content: '', // We don't store the raw content in the response
          parsed: projData
        };

        // If no CRS is set, try to derive it from .prj file
        if (!project.crs || !project.crs.horizontal) {
          project.crs = projFileService.projDataToCRS(projData);
        }
      }

      if (worldData) {
        project.worldFile = {
          content: '', // We don't store the raw content in the response
          parsed: worldData
        };
      }

      // If no location is set, try to derive it from .prj or .tfw files
      if (!project.location || (!project.location.latitude && !project.location.longitude)) {
        let derivedLocation = null;

        // Try world file first (usually more accurate for location)
        if (worldData) {
          // Use EPSG code from .prj file if available for accurate projection
          const spatialRef = projData?.epsgCode ? projData.epsgCode.replace('EPSG:', '') : undefined;
          derivedLocation = await worldFileService.worldFileToGeographic(worldData, spatialRef);
          if (!derivedLocation) {
            // Try center point calculation
            derivedLocation = await worldFileService.getCenterPoint(worldData, spatialRef);
          }
        }

        // Fall back to .prj file if world file didn't work
        if (!derivedLocation && projData) {
          derivedLocation = await projFileService.getLocationFromProj(projData);
        }

        if (derivedLocation && derivedLocation.latitude && derivedLocation.longitude) {
          project.location = {
            latitude: derivedLocation.latitude,
            longitude: derivedLocation.longitude,
            address: project.location?.address || ''
          };
        }
      }

      // Store the file data in MongoDB if we found any
      if (projData || worldData) {
        try {
          await this.updateProjectFiles(jobNumber, {
            projFile: projData ? {
              content: '', // Could store actual content here if needed
              parsed: projData
            } : undefined,
            worldFile: worldData ? {
              content: '', // Could store actual content here if needed
              parsed: worldData
            } : undefined
          });
        } catch (updateError) {
          console.log(`Failed to update project files in database for ${jobNumber}:`, updateError);
        }
      }
    } catch (error) {
      console.log(`No .prj or .tfw files found for project ${jobNumber}:`, error);
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

  /**
   * Update project files (prj/tfw) in the database
   */
  async updateProjectFiles(jobNumber: string, fileData: {
    projFile?: { content: string; parsed?: ProjFileData };
    worldFile?: { content: string; parsed?: WorldFileData };
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
