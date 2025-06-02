import { Project } from "@/types/project";
import { sourcesJsonService } from "@/services/sourcesJsonService";
import { worldFileService } from "@/services/worldFileService";
import { projFileService } from "@/services/projFileService";

interface PotreeMetadata {
  version: string;
  octreeDir: string;
  points: number;
  boundingBox: {
    lx: number;
    ly: number;
    lz: number;
    ux: number;
    uy: number;
    uz: number;
  };
  tightBoundingBox?: {
    lx: number;
    ly: number;
    lz: number;
    ux: number;
    uy: number;
    uz: number;
  };
  pointAttributes: string[];
  spacing: number;
  scale: number[];
  hierarchyStepSize: number;
  projection?: string;
  gpsTimeRange?: [number, number];
  coordinateSystem?: string;
  crs?: string;
}

interface PotreeCloudJs {
  type: string;
  version: string;
  octreeDir: string;
  points: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  tightBoundingBox?: {
    min: [number, number, number];
    max: [number, number, number];
  };
  pointAttributes: string[];
  spacing: number;
  scale: [number, number, number];
  hierarchyStepSize: number;
  projection?: string;
  coordinateSystem?: string;
}

export const potreeLocationService = {
  /**
   * Extract location data from Potree point cloud metadata
   */
  async extractLocationFromPotree(jobNumber: string): Promise<Partial<Project> | null> {
    try {
      const baseUrl = "http://localhost:4400/pointclouds/";
      
      // Try to fetch world file first (highest priority)
      try {
        const worldFileData = await worldFileService.extractLocationFromWorldFile(jobNumber);
        if (worldFileData) {
          console.log("Found world file data, using for location");
          return worldFileData;
        }
      } catch (error) {
        console.log("No world file found or error processing it:", error instanceof Error ? error.message : "Unknown error");
      }
      
      // Try to fetch .prj file next
      try {
        const projFileData = await projFileService.extractLocationFromProjFile(jobNumber);
        if (projFileData) {
          console.log("Found .prj file data, using for location");
          return projFileData;
        }
      } catch (error) {
        console.log("No .prj file found or error processing it:", error instanceof Error ? error.message : "Unknown error");
      }
      
      // Try to fetch sources.json next
      try {
        const sourcesResponse = await fetch(`${baseUrl}${jobNumber}/sources.json`);
        if (sourcesResponse.ok) {
          console.log("Found sources.json, extracting data...");
          return await sourcesJsonService.extractLocationFromSourcesJson(jobNumber);
        }
      } catch (error) {
        console.log("No sources.json found, trying metadata.json", error instanceof Error ? error.message : "Unknown error");
      }
      
      // Try to fetch metadata.json next
      let metadata: PotreeMetadata | null = null;
      try {
        const metadataResponse = await fetch(`${baseUrl}${jobNumber}/metadata.json`);
        if (metadataResponse.ok) {
          metadata = await metadataResponse.json();
          console.log("Found Potree metadata.json:", metadata);
        } else {
          console.log("No metadata.json found or not accessible, trying cloud.js");
        }
      } catch (error) {
        console.log("No metadata.json found, trying cloud.js", error instanceof Error ? error.message : "Unknown error");
      }

      // If no metadata.json, try cloud.js
      if (!metadata) {
        try {
          const cloudJsResponse = await fetch(`${baseUrl}${jobNumber}/cloud.js`);
          if (cloudJsResponse.ok) {
            const cloudJsText = await cloudJsResponse.text();
            // Parse cloud.js content (it's usually a JavaScript assignment)
            const jsonMatch = cloudJsText.match(/=\s*({[\s\S]*})\s*;?\s*$/);
            if (jsonMatch) {
              const cloudData: PotreeCloudJs = JSON.parse(jsonMatch[1]);
              console.log("Found Potree cloud.js:", cloudData);
              
              // Convert cloud.js format to metadata format
              metadata = {
                version: cloudData.version,
                octreeDir: cloudData.octreeDir,
                points: cloudData.points,
                boundingBox: {
                  lx: cloudData.boundingBox.min[0],
                  ly: cloudData.boundingBox.min[1],
                  lz: cloudData.boundingBox.min[2],
                  ux: cloudData.boundingBox.max[0],
                  uy: cloudData.boundingBox.max[1],
                  uz: cloudData.boundingBox.max[2]
                },
                pointAttributes: cloudData.pointAttributes,
                spacing: cloudData.spacing,
                scale: cloudData.scale,
                hierarchyStepSize: cloudData.hierarchyStepSize,
                projection: cloudData.projection,
                coordinateSystem: cloudData.coordinateSystem
              };

              if (cloudData.tightBoundingBox) {
                metadata.tightBoundingBox = {
                  lx: cloudData.tightBoundingBox.min[0],
                  ly: cloudData.tightBoundingBox.min[1],
                  lz: cloudData.tightBoundingBox.min[2],
                  ux: cloudData.tightBoundingBox.max[0],
                  uy: cloudData.tightBoundingBox.max[1],
                  uz: cloudData.tightBoundingBox.max[2]
                };
              }
            } else {
              console.log("Could not parse cloud.js content");
            }
          } else {
            console.log("No cloud.js found or not accessible");
          }
        } catch (error) {
          console.log("No cloud.js found either", error instanceof Error ? error.message : "Unknown error");
        }
      }

      if (!metadata) {
        console.log("No Potree metadata found for job:", jobNumber);
        return null;
      }

      // Extract location from bounding box
      const location = this.extractLocationFromBounds(metadata);
      
      // Extract CRS information
      const crs = this.extractCRSFromMetadata(metadata);

      // Build project data
      const projectData: Partial<Project> = {
        jobNumber,
        projectName: `Project ${jobNumber}`,
        description: `Point cloud project with ${metadata.points.toLocaleString()} points`,
        projectType: "survey"
      };

      if (location) {
        projectData.location = location;
      }

      if (crs) {
        projectData.crs = crs;
      }

      console.log("Extracted project data from Potree:", projectData);
      return projectData;

    } catch (error) {
      console.error("Error extracting location from Potree:", error);
      return null;
    }
  },

  /**
   * Extract geographic location from bounding box coordinates
   */
  extractLocationFromBounds(metadata: PotreeMetadata): Project["location"] | null {
    try {
      const bbox = metadata.tightBoundingBox || metadata.boundingBox;
      
      // Calculate center point
      const centerX = (bbox.lx + bbox.ux) / 2;
      const centerY = (bbox.ly + bbox.uy) / 2;

      // Check if coordinates look like geographic coordinates (lat/lon)
      if (this.isGeographicCoordinates(centerX, centerY)) {
        return {
          latitude: centerY,
          longitude: centerX,
          source: "potree_bounds" as const,
          confidence: "medium" as const
        };
      }

      // Check if coordinates look like projected coordinates that need conversion
      if (this.isProjectedCoordinates(centerX, centerY)) {
        // Try to convert using known Indiana projections
        const converted = this.convertProjectedToGeographic(centerX, centerY);
        if (converted) {
          return {
            latitude: converted.lat,
            longitude: converted.lon,
            source: "potree_bounds" as const,
            confidence: "medium" as const
          };
        }
      }

      // If we can't determine the coordinate system, still store the raw coordinates
      // They might be useful for relative positioning
      return {
        latitude: centerY,
        longitude: centerX,
        source: "potree_bounds" as const,
        confidence: "low" as const
      };

    } catch (error) {
      console.error("Error extracting location from bounds:", error);
      return null;
    }
  },

  /**
   * Extract CRS information from metadata
   */
  extractCRSFromMetadata(metadata: PotreeMetadata): Project["crs"] | null {
    try {
      let horizontal = metadata.projection || metadata.coordinateSystem || metadata.crs;
      
      // Clean up and standardize CRS format
      if (horizontal) {
        // Remove common prefixes and clean up
        horizontal = horizontal.replace(/^(EPSG:|epsg:)/i, "EPSG:");
        
        // If it doesn't start with EPSG:, try to identify it
        if (!horizontal.startsWith("EPSG:")) {
          // Look for EPSG codes in the string
          const epsgMatch = horizontal.match(/(\d{4,5})/);
          if (epsgMatch) {
            horizontal = `EPSG:${epsgMatch[1]}`;
          }
        }

        return {
          horizontal,
          vertical: "EPSG:6360", // Default to NAVD88 height for Indiana
          geoidModel: "GEOID18"
        };
      }

      return null;
    } catch (error) {
      console.error("Error extracting CRS from metadata:", error);
      return null;
    }
  },

  /**
   * Check if coordinates look like geographic (lat/lon) coordinates
   */
  isGeographicCoordinates(x: number, y: number): boolean {
    return (
      x >= -180 && x <= 180 && 
      y >= -90 && y <= 90 &&
      Math.abs(x) > 0.01 && Math.abs(y) > 0.01 // Not exactly zero
    );
  },

  /**
   * Check if coordinates look like projected coordinates
   */
  isProjectedCoordinates(x: number, y: number): boolean {
    // Indiana State Plane coordinates are typically in the range:
    // X (Easting): 100,000 - 1,200,000 feet
    // Y (Northing): 1,200,000 - 1,700,000 feet
    return (
      (x > 50000 && x < 2000000) &&
      (y > 500000 && y < 2000000)
    );
  },

  /**
   * Convert projected coordinates to geographic coordinates
   * This is a simplified conversion - in production you'd use proj4js
   */
  convertProjectedToGeographic(x: number, y: number): { lat: number; lon: number } | null {
    try {
      // This is a very rough approximation for Indiana State Plane coordinates
      // In a real implementation, you'd use proj4js with proper projection definitions
      
      // Check if coordinates are in the range for Indiana State Plane
      if (x >= 3000000 && x <= 4000000 && y >= 1000000 && y <= 2000000) {
        // Very rough conversion for Indiana coordinates
        // These are approximate values for demonstration
        const lat = 39.76 + ((y - 1725000) / 100000) * 0.9;
        const lon = -86.15 + ((x - 3155000) / 100000) * 1.1;
        
        // Check if result is reasonable for Indiana
        if (lat >= 37.5 && lat <= 41.8 && lon >= -88.1 && lon <= -84.8) {
          return { lat, lon };
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error converting projected coordinates:", error);
      return null;
    }
  },

  /**
   * Get project info including location data from Potree
   */
  async getProjectInfo(jobNumber: string): Promise<Partial<Project> | null> {
    try {
      // First try to get project data from Potree metadata
      const potreeData = await this.extractLocationFromPotree(jobNumber);
      
      if (potreeData) {
        return potreeData;
      }

      // If no Potree data, return basic project structure
      return {
        jobNumber,
        projectName: `Project ${jobNumber}`,
        description: "Point cloud project",
        projectType: "survey",
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

    } catch (error) {
      console.error("Error getting project info:", error);
      return null;
    }
  }
};
