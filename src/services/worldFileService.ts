import { arcgisService } from "./arcgisService";

export interface WorldFileData {
  pixelSizeX: number;
  rotationY: number;
  rotationX: number;
  pixelSizeY: number;
  upperLeftX: number;
  upperLeftY: number;
}

export const worldFileService = {
  /**
   * Parse a .tfw file content and extract transformation parameters
   */
  parseWorldFile(content: string): WorldFileData | null {
    try {
      const lines = content.trim().split('\n').map(line => line.trim());
      
      if (lines.length < 6) {
        console.error('World file must contain 6 lines');
        return null;
      }

      const values = lines.map(line => parseFloat(line));
      
      // Validate that all values are numbers
      if (values.some(val => isNaN(val))) {
        console.error('World file contains invalid numeric values');
        return null;
      }

      return {
        pixelSizeX: values[0],      // X-component of the pixel width (x-scale)
        rotationY: values[1],       // Y-component of the pixel width (y-skew)
        rotationX: values[2],       // X-component of the pixel height (x-skew)
        pixelSizeY: values[3],      // Y-component of the pixel height (y-scale, typically negative)
        upperLeftX: values[4],      // X-coordinate of the center of the upper left pixel
        upperLeftY: values[5]       // Y-coordinate of the center of the upper left pixel
      };
    } catch (error) {
      console.error('Error parsing world file:', error);
      return null;
    }
  },

  /**
   * Fetch and parse a .tfw file for a given job number
   */
  async fetchWorldFile(jobNumber: string): Promise<WorldFileData | null> {
    try {
      const response = await fetch(`http://localhost:4400/pointclouds/${jobNumber}/${jobNumber}.tfw`);
      if (!response.ok) {
        console.log(`No .tfw file found for job ${jobNumber}`);
        return null;
      }
      
      const content = await response.text();
      return this.parseWorldFile(content);
    } catch (error) {
      console.error(`Error fetching .tfw file for job ${jobNumber}:`, error);
      return null;
    }
  },

  /**
   * Convert world file coordinates to geographic coordinates using ArcGIS REST API
   */
  async worldFileToGeographic(
    worldData: WorldFileData,
    spatialReference?: string | number,
    imageWidth: number = 1000,
    imageHeight: number = 1000
  ): Promise<{ latitude?: number; longitude?: number } | null> {
    try {
      // If we have a spatial reference, use ArcGIS REST API for accurate projection
      if (spatialReference) {
        const epsgCode = arcgisService.normalizeEpsgCode(spatialReference);
        if (epsgCode) {
          try {
            const result = await arcgisService.worldFileToGeographic(
              worldData,
              epsgCode,
              imageWidth,
              imageHeight
            );
            if (result) {
              return result;
            }
          } catch (projectionError) {
            console.warn('ArcGIS projection failed, falling back to approximation:', projectionError);
          }
        }
      }

      // Fallback to simple approximation
      const x = worldData.upperLeftX;
      const y = worldData.upperLeftY;
      
      // Validate coordinates
      if (!isFinite(x) || !isFinite(y)) {
        console.warn('World file coordinates are not finite');
        return null;
      }
      
      // Check if coordinates look like they're in feet (typical for state plane)
      const isInFeet = Math.abs(x) > 100000 || Math.abs(y) > 100000;
      
      if (isInFeet) {
        // Rough conversion for Indiana state plane coordinates (feet)
        // These are very approximate formulas for demonstration
        const approxLon = -87.0 + (x - 240000) / 364000;
        const approxLat = 38.0 + (y - 118000) / 364000;
        
        // Clamp to reasonable Indiana bounds
        const lat = Math.max(37.5, Math.min(41.5, approxLat));
        const lon = Math.max(-88.5, Math.min(-84.5, approxLon));
        
        return {
          latitude: lat,
          longitude: lon
        };
      } else {
        // Coordinates might already be in geographic (decimal degrees)
        if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
          return {
            longitude: x,
            latitude: y
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error converting world file coordinates:', error);
      return null;
    }
  },

  /**
   * Get the center point of the area covered by the world file
   * Useful for determining the project's central location
   */
  async getCenterPoint(
    worldData: WorldFileData,
    spatialReference?: string | number,
    imageWidth: number = 1000,
    imageHeight: number = 1000
  ): Promise<{ latitude?: number; longitude?: number } | null> {
    try {
      // Validate world data
      if (!worldData || 
          typeof worldData.upperLeftX !== 'number' || 
          typeof worldData.upperLeftY !== 'number' ||
          typeof worldData.pixelSizeX !== 'number' || 
          typeof worldData.pixelSizeY !== 'number') {
        console.warn('Invalid world file data for center point calculation');
        return null;
      }

      // Calculate the center of the image in world coordinates
      const centerX = worldData.upperLeftX + (imageWidth / 2) * worldData.pixelSizeX;
      const centerY = worldData.upperLeftY + (imageHeight / 2) * worldData.pixelSizeY;
      
      // Validate calculated center
      if (!isFinite(centerX) || !isFinite(centerY)) {
        console.warn('Calculated center coordinates are not finite');
        return null;
      }

      // Create a temporary world data object for the center point
      const centerWorldData: WorldFileData = {
        ...worldData,
        upperLeftX: centerX,
        upperLeftY: centerY
      };
      
      return this.worldFileToGeographic(centerWorldData, spatialReference, 1, 1);
    } catch (error) {
      console.error('Error calculating center point:', error);
      return null;
    }
  }
};
