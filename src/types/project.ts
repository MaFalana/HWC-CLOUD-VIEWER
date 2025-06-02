
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
export function isValidParsedPrj(obj: unknown): obj is ParsedPRJ {
  if (!obj || typeof obj !== "object") return false;
  
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.projcs === "string" &&
    typeof candidate.geogcs === "string" &&
    typeof candidate.datum === "string" &&
    typeof candidate.spheroid === "string" &&
    typeof candidate.projection === "string" &&
    typeof candidate.parameters === "object" && candidate.parameters !== null &&
    typeof candidate.unit === "string" &&
    typeof candidate.authority === "string"
  );
}

// Type guard function to validate parsed world file data
export function isValidParsedWorldFile(obj: unknown): obj is ParsedWorldFile {
  if (!obj || typeof obj !== "object") return false;
  
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.upperLeftX === "number" &&
    typeof candidate.upperLeftY === "number" &&
    typeof candidate.pixelSizeX === "number" &&
    typeof candidate.pixelSizeY === "number"
  );
}
