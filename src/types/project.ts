
// Define the parsed .prj file structure
export interface ParsedPRJ {
  projcs: string;
  geogcs: string;
  datum: string;
  spheroid: string;
  projection: string;
  parameters: Record<string, number>;
  unit: string;
  authority: string;
  epsgCode?: string;
}

// Define the parsed world file structure
export interface ParsedWorldFile {
  upperLeftX: number;
  upperLeftY: number;
  pixelSizeX: number;
  pixelSizeY: number;
  rotationX?: number;
  rotationY?: number;
}

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
    parsed?: Partial<ParsedPRJ>;
  };
  worldFile?: {
    content: string;
    parsed?: Partial<ParsedWorldFile>;
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

// Type guard function to validate parsed PRJ data
export function isValidParsedPrj(obj: any): obj is ParsedPRJ {
  return (
    obj &&
    typeof obj.projcs === "string" &&
    typeof obj.geogcs === "string" &&
    typeof obj.datum === "string" &&
    typeof obj.spheroid === "string" &&
    typeof obj.projection === "string" &&
    typeof obj.parameters === "object" &&
    typeof obj.unit === "string" &&
    typeof obj.authority === "string"
  );
}

// Type guard function to validate parsed world file data
export function isValidParsedWorldFile(obj: any): obj is ParsedWorldFile {
  return (
    obj &&
    typeof obj.upperLeftX === "number" &&
    typeof obj.upperLeftY === "number" &&
    typeof obj.pixelSizeX === "number" &&
    typeof obj.pixelSizeY === "number"
  );
}
