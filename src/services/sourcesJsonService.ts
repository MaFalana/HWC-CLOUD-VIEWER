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
          // Central Indiana (Marion County area)
          { easting: 3154601.912, northing: 1727378.764, lat: 39.7684, lon: -86.1581 },
          
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
      
      // Check for other coordinate ranges (meters, different projections)
      if (x >= 250000 && x <= 750000 && y >= 4200000 && y <= 4700000) {
        // UTM Zone 16N coordinates (meters)
        // Rough conversion for Indiana UTM coordinates
        const utmToLatLon = this.convertUTMToLatLon(x, y, 16);
        if (utmToLatLon) {
          console.log(`UTM coordinates converted: [${x}, ${y}] -> [${utmToLatLon.lat}, ${utmToLatLon.lon}]`);
          return utmToLatLon;
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error converting projected coordinates:", error);
      return null;
    }
  },
  
  /**
   * Convert UTM coordinates to lat/lon (simplified)
   */
  convertUTMToLatLon(easting: number, northing: number, zone: number): { lat: number; lon: number } | null {
    try {
      // Simplified UTM to lat/lon conversion for Indiana (Zone 16N)
      // This is a rough approximation - in production use proj4js
      
      const centralMeridian = -87; // Central meridian for UTM Zone 16
      const falseEasting = 500000;
      const falseNorthing = 0;
      
      // Rough conversion (not geodetically accurate)
      const deltaEasting = easting - falseEasting;
      const deltaNorthing = northing - falseNorthing;
      
      // Approximate scale factors for Indiana
      const lat = 39.5 + (deltaNorthing / 111000); // ~111km per degree latitude
      const lon = centralMeridian + (deltaEasting / (111000 * Math.cos(lat * Math.PI / 180))); // varies with latitude
      
      // Validate result
      if (lat >= 37.0 && lat <= 42.0 && lon >= -88.5 && lon <= -84.5) {
        return { lat, lon };
      }
      
      return null;
    } catch (error) {
      console.error("Error converting UTM coordinates:", error);
      return null;
    }
  }
};
