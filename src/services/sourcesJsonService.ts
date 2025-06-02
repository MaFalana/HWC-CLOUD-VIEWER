
import { Project } from "@/types/project";

interface SourcesBounds {
  min: [number, number, number];
  max: [number, number, number];
}

interface SourcesFile {
  bounds: SourcesBounds;
  projection: string;
  sources: {
    name: string;
    points: number;
    bounds: SourcesBounds;
  }[];
}

export const sourcesJsonService = {
  /**
   * Extract location data from sources.json file
   */
  async extractLocationFromSourcesJson(jobNumber: string): Promise<Partial<Project> | null> {
    try {
      const baseUrl = "http://localhost:4400/pointclouds/";
      
      // Try to fetch sources.json
      try {
        const sourcesResponse = await fetch(`${baseUrl}${jobNumber}/sources.json`);
        if (sourcesResponse.ok) {
          const sourcesData: SourcesFile = await sourcesResponse.json();
          console.log("Found sources.json:", sourcesData);
          
          if (sourcesData.bounds) {
            // Extract location from bounds
            const location = this.extractLocationFromBounds(sourcesData.bounds);
            
            // Extract CRS information
            const crs = this.extractCRSFromProjection(sourcesData.projection);
            
            // Calculate total points
            const totalPoints = sourcesData.sources.reduce((sum, source) => sum + source.points, 0);
            
            // Build project data
            const projectData: Partial<Project> = {
              jobNumber,
              projectName: `Project ${jobNumber}`,
              description: `Point cloud project with ${totalPoints.toLocaleString()} points`,
              projectType: "survey"
            };
            
            if (location) {
              projectData.location = location;
            }
            
            if (crs) {
              projectData.crs = crs;
            }
            
            console.log("Extracted project data from sources.json:", projectData);
            return projectData;
          }
        } else {
          console.log("No sources.json found or not accessible");
        }
      } catch (error) {
        console.log("Error fetching sources.json:", error instanceof Error ? error.message : "Unknown error");
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting location from sources.json:", error);
      return null;
    }
  },
  
  /**
   * Extract geographic location from bounds coordinates
   */
  extractLocationFromBounds(bounds: SourcesBounds): Project["location"] | null {
    try {
      // Calculate center point
      const centerX = (bounds.min[0] + bounds.max[0]) / 2;
      const centerY = (bounds.min[1] + bounds.max[1]) / 2;
      
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
   * Extract CRS information from projection string
   */
  extractCRSFromProjection(projection: string): Project["crs"] | null {
    try {
      if (!projection) {
        return null;
      }
      
      // Clean up and standardize CRS format
      let horizontal = projection.replace(/^(EPSG:|epsg:)/i, "EPSG:");
      
      // If it doesn't start with EPSG:, try to identify it
      if (!horizontal.startsWith("EPSG:")) {
        // Look for EPSG codes in the string
        const epsgMatch = horizontal.match(/(\d{4,5})/);
        if (epsgMatch) {
          horizontal = `EPSG:${epsgMatch[1]}`;
        } else {
          // Default to Indiana State Plane West if no EPSG code found
          horizontal = "EPSG:2965";
        }
      }
      
      return {
        horizontal,
        vertical: "EPSG:6360", // Default to NAVD88 height for Indiana
        geoidModel: "GEOID18"
      };
    } catch (error) {
      console.error("Error extracting CRS from projection:", error);
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
    // Check if coordinates are in a typical range for projected systems
    return (
      Math.abs(x) > 1000 && Math.abs(x) < 10000000 &&
      Math.abs(y) > 1000 && Math.abs(y) < 10000000
    );
  },
  
  /**
   * Convert projected coordinates to geographic coordinates
   * This is a simplified conversion - in production you'd use proj4js
   */
  convertProjectedToGeographic(x: number, y: number): { lat: number; lon: number } | null {
    try {
      // For Indiana State Plane coordinates (NAD83 / Indiana West, EPSG:2965)
      // This is a very rough approximation
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
  }
};
