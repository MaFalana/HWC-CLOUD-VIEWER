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
    parsed?: {
      projcs: string;
      geogcs: string;
      datum: string;
      spheroid: string;
      projection: string;
      parameters: Record<string, number>;
      unit: string;
      authority: string;
      epsgCode?: string;
    };
  };
  worldFile?: {
    content: string;
    parsed?: {
      pixelSizeX: number;
      rotationY: number;
      rotationX: number;
      pixelSizeY: number;
      upperLeftX: number;
      upperLeftY: number;
    };
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
  clientName?: string;
  acquistionDate?: string;
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
  projectType?: string;
  tags?: string[];
}

export interface CRSOption {
  code: string;
  name: string;
  type: "horizontal" | "vertical" | "geoid";
}
