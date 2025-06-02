
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
   * Extract location data from world file
   */
  async extractLocationFromWorldFile(jobNumber: string): Promise<Partial<Project> | null> {
    try {
      // Try to fetch world file with different extensions
      const worldFileExtensions = [".tfw", ".jgw", ".wld", ".tifw", ".pgw", ".gfw"];
      let worldFileData = null;
      
      for (const ext of worldFileExtensions) {
        try {
          const response = await fetch(`http://localhost:4400/pointclouds/${jobNumber}/${jobNumber}${ext}`);
          if (response.ok) {
            const content = await response.text();
            worldFileData = worldFileService.parseWorldFile(content);
            if (worldFileData) {
              console.log(`Found world file with extension ${ext}:`, worldFileData);
              break;
            }
          }
        } catch (error) {
          console.log(`No world file with extension ${ext} found:`, error instanceof Error ? error.message : "Unknown error");
        }
      }
      
      if (!worldFileData) {
        console.log("No valid world file found for job:", jobNumber);
        return null;
      }
      
      // Get geographic coordinates from world file data
      const geographicCoords = await worldFileService.worldFileToGeographic(worldFileData);
      
      if (!geographicCoords || !geographicCoords.latitude || !geographicCoords.longitude) {
        console.log("Could not convert world file coordinates to geographic coordinates");
        return null;
      }
      
      // Build project data
      const projectData: Partial<Project> = {
        jobNumber,
        projectName: `Project ${jobNumber}`,
        description: "Point cloud project with world file data",
        projectType: "survey",
        location: {
          latitude: geographicCoords.latitude,
          longitude: geographicCoords.longitude,
          source: "world_file" as const,
          confidence: "high" as const
        }
      };
      
      console.log("Extracted project data from world file:", projectData);
      return projectData;
      
    } catch (error) {
      console.error("Error extracting location from world file:", error);
      return null;
    }
  },
  
  /**
   * Extract location data from .prj file
   */
  async extractLocationFromProjFile(jobNumber: string): Promise<Partial<Project> | null> {
    try {
      // Try to fetch .prj file
      const projData = await projFileService.fetchProjFile(jobNumber);
      
      if (!projData) {
        console.log("No .prj file found or could not parse it");
        return null;
      }
      
      console.log("Found .prj file data:", projData);
      
      // Extract CRS information
      const crs = projFileService.projDataToCRS(projData);
      
      // Get location from proj data
      const geographicCoords = await projFileService.getLocationFromProj(projData);
      
      // Build project data
      const projectData: Partial<Project> = {
        jobNumber,
        projectName: `Project ${jobNumber}`,
        description: "Point cloud project with projection data",
        projectType: "survey",
        crs
      };
      
      if (geographicCoords && geographicCoords.latitude && geographicCoords.longitude) {
        projectData.location = {
          latitude: geographicCoords.latitude,
          longitude: geographicCoords.longitude,
          source: "proj_file" as const,
          confidence: "medium" as const
        };
      }
      
      console.log("Extracted project data from .prj file:", projectData);
      return projectData;
      
    } catch (error) {
      console.error("Error extracting location from .prj file:", error);
      return null;
    }
  },

  /**
   * Extract location data from Potree point cloud metadata
   */
  async extractLocationFromPotree(jobNumber: string): Promise<Partial<Project> | null> {
    try {
      const baseUrl = "http://localhost:4400/pointclouds/";
      
      // Try to fetch world file first (highest priority)
      try {
        const worldFileData = await this.extractLocationFromWorldFile(jobNumber);
        if (worldFileData) {
          console.log("Found world file data, using for location");
          return worldFileData;
        }
      } catch (error) {
        console.log("No world file found or error processing it:", error instanceof Error ? error.message : "Unknown error");
      }
      
      // Try to fetch .prj file next
      try {
        const projFileData = await this.extractLocationFromProjFile(jobNumber);
        if (projFileData) {
          console.log("Found .prj file data, using for location");
          return projFileData;
        }
      } catch (error) {
        console.log("No .prj file found or error processing it:", error instanceof Error ? error.message : "Unknown error");
      }
      
      // Try to fetch sources.json next (prioritize this for county coordinates)
      try {
        const sourcesResponse = await fetch(`${baseUrl}${jobNumber}/sources.json`);
        if (sourcesResponse.ok) {
          console.log("Found sources.json, extracting data...");
          const sourcesData = await sourcesResponse.json();
          
          // Check if the bounds look like Indiana county coordinates
          if (sourcesData.bounds && 
              sourcesData.bounds.min && 
              sourcesData.bounds.min[0] >= 2500000 && 
              sourcesData.bounds.min[0] <= 4500000 && 
              sourcesData.bounds.min[1] >= 1000000 && 
              sourcesData.bounds.min[1] <= 2500000) {
            console.log("Sources.json contains county coordinates, prioritizing this data");
            return await sourcesJsonService.extractLocationFromSourcesJson(jobNumber);
          } else {
            // Still try to extract location but with lower priority
            const sourcesProjectData = await sourcesJsonService.extractLocationFromSourcesJson(jobNumber);
            if (sourcesProjectData && sourcesProjectData.location && sourcesProjectData.location.confidence === "medium") {
              return sourcesProjectData;
            }
          }
        }
      } catch (error) {
        console.log("No sources.json found or error processing it:", error instanceof Error ? error.message : "Unknown error");
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
   * Enhanced for county coordinate systems
   */
  convertProjectedToGeographic(x: number, y: number): { lat: number; lon: number } | null {
    try {
      // Enhanced conversion for Indiana county coordinate systems
      // These are typically in State Plane coordinates (feet)
      
      // Check if coordinates are in the range for Indiana State Plane/County coordinates
      if (x >= 2500000 && x <= 4500000 && y >= 1000000 && y <= 2500000) {
        // Enhanced reference points covering more Indiana counties
        const refPoints = [
          // Central Indiana (Marion County area) - Peabody West 1 reference point
          { easting: 3154601.912, northing: 1727378.764, lat: 39.7684, lon: -86.1581 },
          
          // Additional reference point for Peabody West 1 area
          { easting: 3153483.692, northing: 1725305.985, lat: 39.7650, lon: -86.1610 },
          
          // Vanderburgh County (Evansville area) - Southwest Indiana
          { easting: 2800000, northing: 1200000, lat: 37.9747, lon: -87.5558 },
          
          // Allen County (Fort Wayne area) - Northeast Indiana
          { easting: 3800000, northing: 2100000, lat: 41.0793, lon: -85.1394 },
          
          // Lake County (Gary area) - Northwest Indiana
          { easting: 2900000, northing: 2300000, lat: 41.5868, lon: -87.3467 },
          
          // Monroe County (Bloomington area) - South Central Indiana
          { easting: 3100000, northing: 1400000, lat: 39.1653, lon: -86.5264 },
          
          // St. Joseph County (South Bend area) - North Central Indiana
          { easting: 3200000, northing: 2200000, lat: 41.7018, lon: -86.2390 },
          
          // Additional reference points for better coverage
          { easting: 3300000, northing: 1600000, lat: 39.4, lon: -85.8 }, // East Central
          { easting: 2900000, northing: 1800000, lat: 40.2, lon: -87.2 }, // West Central
          { easting: 3500000, northing: 1900000, lat: 40.5, lon: -85.5 }, // Northeast
          { easting: 3000000, northing: 1300000, lat: 38.8, lon: -86.8 }  // Southwest
        ];
        
        // Find the closest reference point
        let closestRef = refPoints[0];
        let minDistance = Math.sqrt(Math.pow(x - refPoints[0].easting, 2) + Math.pow(y - refPoints[0].northing, 2));
        
        for (const ref of refPoints) {
          const distance = Math.sqrt(Math.pow(x - ref.easting, 2) + Math.pow(y - ref.northing, 2));
          if (distance < minDistance) {
            minDistance = distance;
            closestRef = ref;
          }
        }
        
        // Calculate offset from closest reference point
        const deltaEasting = x - closestRef.easting;
        const deltaNorthing = y - closestRef.northing;
        
        // Convert feet to degrees using accurate scale factors for Indiana
        // Scale factors vary slightly by latitude, but these are good approximations for Indiana
        const avgLatitude = closestRef.lat;
        const latScale = 364000; // feet per degree latitude (constant)
        const lonScale = 288200 * Math.cos(avgLatitude * Math.PI / 180); // feet per degree longitude (varies with latitude)
        
        const latOffset = deltaNorthing / latScale;
        const lonOffset = deltaEasting / lonScale;
        
        const lat = closestRef.lat + latOffset;
        const lon = closestRef.lon + lonOffset;
        
        // Validate result is within Indiana bounds (with some tolerance)
        if (lat >= 37.0 && lat <= 42.0 && lon >= -88.5 && lon <= -84.5) {
          console.log(`County coordinates converted: [${x}, ${y}] -> [${lat.toFixed(6)}, ${lon.toFixed(6)}] using ref [${closestRef.easting}, ${closestRef.northing}] at [${closestRef.lat}, ${closestRef.lon}]`);
          return { lat, lon };
        } else {
          console.warn(`Converted coordinates [${lat}, ${lon}] are outside Indiana bounds`);
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
