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

      // Enhanced fallback conversion for county coordinate systems
      const x = worldData.upperLeftX;
      const y = worldData.upperLeftY;
      
      // Validate coordinates
      if (!isFinite(x) || !isFinite(y)) {
        console.warn('World file coordinates are not finite');
        return null;
      }
      
      // Check if coordinates are in Indiana county coordinate range (feet)
      if (x >= 2500000 && x <= 4500000 && y >= 1000000 && y <= 2500000) {
        // Enhanced reference points for Indiana counties
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
        const avgLatitude = closestRef.lat;
        const latScale = 364000; // feet per degree latitude (constant)
        const lonScale = 288200 * Math.cos(avgLatitude * Math.PI / 180); // feet per degree longitude (varies with latitude)
        
        const latOffset = deltaNorthing / latScale;
        const lonOffset = deltaEasting / lonScale;
        
        const lat = closestRef.lat + latOffset;
        const lon = closestRef.lon + lonOffset;
        
        // Validate result is within Indiana bounds
        if (lat >= 37.0 && lat <= 42.0 && lon >= -88.5 && lon <= -84.5) {
          console.log(`World file county coordinates converted: [${x}, ${y}] -> [${lat.toFixed(6)}, ${lon.toFixed(6)}]`);
          return {
            latitude: lat,
            longitude: lon
          };
        }
      }
      
      // Check if coordinates might already be in geographic (decimal degrees)
      if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
        return {
          longitude: x,
          latitude: y
        };
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
