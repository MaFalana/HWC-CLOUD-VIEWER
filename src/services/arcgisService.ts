
// Service for using ArcGIS REST API for coordinate reference system operations
export interface ArcGISGeometryService {
  project: (geometries: any[], inSR: string | number, outSR: string | number) => Promise<any>;
  findTransformations: (inSR: string | number, outSR: string | number, extentOfInterest?: any) => Promise<any>;
}

export interface SpatialReference {
  wkid?: number;
  latestWkid?: number;
  wkt?: string;
}

export interface ProjectionResult {
  geometries: Array<{
    x: number;
    y: number;
  }>;
}

export const arcgisService = {
  // ArcGIS Online Geometry Service URL
  geometryServiceUrl: 'https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer',

  /**
   * Project coordinates from one spatial reference system to another using ArcGIS REST API
   */
  async projectCoordinates(
    coordinates: { x: number; y: number }[],
    fromSR: string | number,
    toSR: string | number = 4326 // Default to WGS84
  ): Promise<{ latitude: number; longitude: number }[]> {
    try {
      const geometries = coordinates.map(coord => ({
        x: coord.x,
        y: coord.y
      }));

      const params = new URLSearchParams({
        f: 'json',
        geometries: JSON.stringify(geometries),
        inSR: fromSR.toString(),
        outSR: toSR.toString()
      });

      const response = await fetch(`${this.geometryServiceUrl}/project?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });

      if (!response.ok) {
        throw new Error(`ArcGIS API request failed: ${response.statusText}`);
      }

      const result: ProjectionResult = await response.json();
      
      if (result.geometries && result.geometries.length > 0) {
        return result.geometries.map(geom => ({
          longitude: geom.x,
          latitude: geom.y
        }));
      }

      throw new Error('No geometries returned from projection');
    } catch (error) {
      console.error('Error projecting coordinates with ArcGIS:', error);
      throw error;
    }
  },

  /**
   * Convert .prj file WKT to EPSG code using ArcGIS REST API
   */
  async wktToEpsg(wkt: string): Promise<number | null> {
    try {
      // Try to extract EPSG code from WKT if it's already there
      const epsgMatch = wkt.match(/AUTHORITY\["EPSG","(\d+)"\]/);
      if (epsgMatch) {
        return parseInt(epsgMatch[1]);
      }

      // If no EPSG code found, we could use ArcGIS REST API to identify the spatial reference
      // This would require additional API calls to the spatial reference service
      console.log('No EPSG code found in WKT, manual identification needed');
      return null;
    } catch (error) {
      console.error('Error converting WKT to EPSG:', error);
      return null;
    }
  },

  /**
   * Get location from .prj file using ArcGIS projection services
   */
  async getLocationFromProjFile(
    projData: { 
      parameters: Record<string, number>;
      epsgCode?: string;
      projcs: string;
    }
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // Extract central meridian and latitude of origin from parameters
      const centralMeridian = projData.parameters['central_meridian'];
      const latitudeOfOrigin = projData.parameters['latitude_of_origin'];
      
      if (centralMeridian !== undefined && latitudeOfOrigin !== undefined) {
        // If we have an EPSG code, use it for projection
        if (projData.epsgCode) {
          const epsgNumber = parseInt(projData.epsgCode.replace('EPSG:', ''));
          
          // Project the central point to WGS84
          const projectedCoords = await this.projectCoordinates(
            [{ x: centralMeridian, y: latitudeOfOrigin }],
            epsgNumber,
            4326
          );
          
          if (projectedCoords.length > 0) {
            return projectedCoords[0];
          }
        }
        
        // Fallback: assume the central meridian and latitude of origin are already in geographic coordinates
        return {
          longitude: centralMeridian,
          latitude: latitudeOfOrigin
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting location from .prj file:', error);
      return null;
    }
  },

  /**
   * Convert world file coordinates to geographic coordinates using ArcGIS projection
   */
  async worldFileToGeographic(
    worldData: {
      upperLeftX: number;
      upperLeftY: number;
      pixelSizeX: number;
      pixelSizeY: number;
    },
    spatialReference: string | number,
    imageWidth: number = 1000,
    imageHeight: number = 1000
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // Calculate center point of the image
      const centerX = worldData.upperLeftX + (imageWidth / 2) * worldData.pixelSizeX;
      const centerY = worldData.upperLeftY + (imageHeight / 2) * worldData.pixelSizeY;

      // Project to WGS84
      const projectedCoords = await this.projectCoordinates(
        [{ x: centerX, y: centerY }],
        spatialReference,
        4326
      );

      if (projectedCoords.length > 0) {
        return projectedCoords[0];
      }

      return null;
    } catch (error) {
      console.error('Error converting world file coordinates:', error);
      return null;
    }
  },

  /**
   * Find appropriate transformations between spatial reference systems
   */
  async findTransformations(
    fromSR: string | number,
    toSR: string | number,
    extentOfInterest?: { xmin: number; ymin: number; xmax: number; ymax: number }
  ): Promise<any> {
    try {
      const params = new URLSearchParams({
        f: 'json',
        inSR: fromSR.toString(),
        outSR: toSR.toString()
      });

      if (extentOfInterest) {
        params.append('extentOfInterest', JSON.stringify(extentOfInterest));
      }

      const response = await fetch(`${this.geometryServiceUrl}/findTransformations?${params}`);
      
      if (!response.ok) {
        throw new Error(`ArcGIS transformation request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error finding transformations:', error);
      throw error;
    }
  },

  /**
   * Validate and normalize EPSG codes
   */
  normalizeEpsgCode(input: string | number): number | null {
    try {
      if (typeof input === 'number') {
        return input;
      }
      
      if (typeof input === 'string') {
        // Handle EPSG:#### format
        const epsgMatch = input.match(/EPSG:(\d+)/i);
        if (epsgMatch) {
          return parseInt(epsgMatch[1]);
        }
        
        // Handle plain number string
        const numberMatch = input.match(/^\d+$/);
        if (numberMatch) {
          return parseInt(input);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error normalizing EPSG code:', error);
      return null;
    }
  },

  /**
   * Get spatial reference information from EPSG code
   */
  async getSpatialReferenceInfo(epsgCode: number): Promise<any> {
    try {
      // This would typically use ArcGIS REST API or another service to get SR info
      // For now, we'll return basic info
      return {
        wkid: epsgCode,
        latestWkid: epsgCode
      };
    } catch (error) {
      console.error('Error getting spatial reference info:', error);
      return null;
    }
  }
};
