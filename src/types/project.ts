
export interface Project {
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
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string;
  orthoImageUrl?: string;
  pointCloudUrl?: string;
  tags?: string[];
  projectType?: string;
}

export interface CreateProjectData {
  jobNumber: string;
  projectName: string;
  description?: string;
  clientName?: string;
  acquistionDate?: string;
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
  projectType?: string;
  tags?: string[];
  thumbnailUrl?: string;
}

export interface CRSOption {
  code: string;
  name: string;
  type: "horizontal" | "vertical" | "geoid";
  recommended?: boolean;
  description?: string;
}
