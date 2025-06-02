// Service for using ArcGIS REST API for coordinate reference system operations
import { CRSOption } from "@/types/project";

export interface Geometry {
  x: number;
  y: number;
}

export interface GeometryCollection {
  geometries: Geometry[];
}

export interface TransformationOptions {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface SpatialReference {
  wkid?: number;
  latestWkid?: number;
  wkt?: string;
  name?: string;
}

export interface ProjectionResult {
  geometries: Array<{
    x: number;
    y: number;
  }>;
  error?: {
    code: number;
    message: string;
  };
}

export interface GeometryServiceResponse<T> {
  results: T[];
  error?: {
    code: number;
    message: string;
  };
}

export interface ArcGISSpatialReference {
  wkid: number;
  latestWkid?: number;
  name: string;
  description?: string;
  wkt?: string;
}

export interface ArcGISCRSResponse {
  spatialReferences: ArcGISSpatialReference[];
  error?: {
    code: number;
    message: string;
  };
}

export const arcgisService = {
  // ArcGIS Online Geometry Service URL
  geometryServiceUrl: 'https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer',
  
  // ArcGIS Online Spatial Reference Service URL
  spatialReferenceServiceUrl: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services',

  /**
   * Project coordinates from one spatial reference system to another using ArcGIS REST API
   */
  async projectCoordinates(
    coordinates: Geometry[],
    fromSR: string | number,
    toSR: string | number = 4326 // Default to WGS84
  ): Promise<{ latitude: number; longitude: number }[]> {
    try {
      // Validate input coordinates
      if (!coordinates || coordinates.length === 0) {
        throw new Error('No coordinates provided for projection');
      }

      // Validate that coordinates have valid numeric values
      const validCoordinates = coordinates.filter(coord => 
        coord && 
        typeof coord.x === 'number' && 
        typeof coord.y === 'number' && 
        !isNaN(coord.x) && 
        !isNaN(coord.y) &&
        isFinite(coord.x) && 
        isFinite(coord.y)
      );

      if (validCoordinates.length === 0) {
        throw new Error('No valid coordinates found for projection');
      }

      const geometries = validCoordinates.map(coord => ({
        x: coord.x,
        y: coord.y
      }));

      const params = new URLSearchParams({
        f: 'json',
        geometries: JSON.stringify({ geometryType: 'esriGeometryPoint', geometries }),
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
        throw new Error(`ArcGIS API request failed: ${response.status} ${response.statusText}`);
      }

      const result: ProjectionResult = await response.json();
      
      // Check for API errors in response
      if ('error' in result && result.error) {
        throw new Error(`ArcGIS API error: ${result.error.message} (Code: ${result.error.code})`);
      }
      
      if (result.geometries && result.geometries.length > 0) {
        // Validate projected coordinates
        const validResults = result.geometries
          .filter(geom => 
            geom && 
            typeof geom.x === 'number' && 
            typeof geom.y === 'number' && 
            !isNaN(geom.x) && 
            !isNaN(geom.y) &&
            isFinite(geom.x) && 
            isFinite(geom.y)
          )
          .map(geom => ({
            longitude: geom.x,
            latitude: geom.y
          }));

        if (validResults.length > 0) {
          return validResults;
        }
      }

      throw new Error('No valid geometries returned from projection');
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
      // Validate world data
      if (!worldData || 
          typeof worldData.upperLeftX !== 'number' || 
          typeof worldData.upperLeftY !== 'number' ||
          typeof worldData.pixelSizeX !== 'number' || 
          typeof worldData.pixelSizeY !== 'number' ||
          isNaN(worldData.upperLeftX) || isNaN(worldData.upperLeftY) ||
          isNaN(worldData.pixelSizeX) || isNaN(worldData.pixelSizeY)) {
        console.warn('Invalid world file data provided');
        return null;
      }

      // Calculate center point of the image
      const centerX = worldData.upperLeftX + (imageWidth / 2) * worldData.pixelSizeX;
      const centerY = worldData.upperLeftY + (imageHeight / 2) * worldData.pixelSizeY;

      // Validate calculated center coordinates
      if (!isFinite(centerX) || !isFinite(centerY)) {
        console.warn('Calculated center coordinates are not finite');
        return null;
      }

      // Project to WGS84
      const projectedCoords = await this.projectCoordinates(
        [{ x: centerX, y: centerY }],
        spatialReference,
        4326
      );

      if (projectedCoords.length > 0) {
        const result = projectedCoords[0];
        
        // Validate projected coordinates are within reasonable bounds
        if (result.latitude >= -90 && result.latitude <= 90 && 
            result.longitude >= -180 && result.longitude <= 180) {
          return result;
        } else {
          console.warn('Projected coordinates are outside valid geographic bounds');
        }
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
    extentOfInterest?: TransformationOptions
  ): Promise<Record<string, unknown>> {
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
  async getSpatialReferenceInfo(epsgCode: number): Promise<SpatialReference> {
    try {
      // This would typically use ArcGIS REST API or another service to get SR info
      // For now, we'll return basic info
      return {
        wkid: epsgCode,
        latestWkid: epsgCode
      };
    } catch (error) {
      console.error('Error getting spatial reference info:', error);
      return { wkid: epsgCode };
    }
  },

  /**
   * Get coordinate reference systems from ArcGIS API
   */
  async getCRSOptions(): Promise<{
    horizontal: CRSOption[];
    vertical: CRSOption[];
    geoid: CRSOption[];
  }> {
    try {
      // Get common horizontal coordinate systems (projected and geographic)
      const horizontalSystems = await this.getHorizontalCRS();
      
      // Get vertical datums
      const verticalSystems = await this.getVerticalCRS();
      
      // Get geoid models
      const geoidModels = await this.getGeoidModels();

      return {
        horizontal: horizontalSystems,
        vertical: verticalSystems,
        geoid: geoidModels
      };
    } catch (error) {
      console.error('Error fetching CRS options from ArcGIS:', error);
      
      // Return fallback options if API fails
      return this.getFallbackCRSOptions();
    }
  },

  /**
   * Get horizontal coordinate reference systems (projected and geographic)
   */
  async getHorizontalCRS(): Promise<CRSOption[]> {
    try {
      // Common horizontal CRS codes that are widely used
      const commonHorizontalCodes = [
        4326, // WGS84
        4269, // NAD83
        4267, // NAD27
        3857, // Web Mercator
        2965, // NAD83 Indiana East (ftUS)
        2966, // NAD83 Indiana West (ftUS)
        26916, // UTM Zone 16N NAD83
        26917, // UTM Zone 17N NAD83
        32616, // UTM Zone 16N WGS84
        32617, // UTM Zone 17N WGS84
        6342, // NAD83(2011) Indiana East (ftUS)
        6343, // NAD83(2011) Indiana West (ftUS)
      ];

      const horizontalSystems: CRSOption[] = [];

      for (const code of commonHorizontalCodes) {
        try {
          const srInfo = await this.getSpatialReferenceDetails(code);
          if (srInfo) {
            horizontalSystems.push({
              code: `EPSG:${code}`,
              name: srInfo.name || `EPSG:${code}`,
              type: "horizontal",
              recommended: this.isRecommendedHorizontal(code),
              description: srInfo.description
            });
          }
        } catch (error) {
          console.warn(`Failed to get details for EPSG:${code}:`, error);
        }
      }

      return horizontalSystems;
    } catch (error) {
      console.error('Error getting horizontal CRS:', error);
      return [];
    }
  },

  /**
   * Get vertical coordinate reference systems
   */
  async getVerticalCRS(): Promise<CRSOption[]> {
    try {
      // Common vertical datums
      const verticalSystems = [
        {
          code: "EPSG:5703",
          name: "NAVD88 height",
          type: "vertical" as const,
          recommended: false,
          description: "North American Vertical Datum of 1988 (meters)"
        },
        {
          code: "EPSG:6360",
          name: "NAVD88 height (ftUS)",
          type: "vertical" as const,
          recommended: true,
          description: "North American Vertical Datum of 1988 (US Survey Feet)"
        },
        {
          code: "EPSG:5701",
          name: "MSL height",
          type: "vertical" as const,
          recommended: false,
          description: "Mean Sea Level height"
        },
        {
          code: "EPSG:5702",
          name: "NGVD29 height",
          type: "vertical" as const,
          recommended: false,
          description: "National Geodetic Vertical Datum of 1929"
        }
      ];

      return verticalSystems;
    } catch (error) {
      console.error('Error getting vertical CRS:', error);
      return [];
    }
  },

  /**
   * Get geoid models
   */
  async getGeoidModels(): Promise<CRSOption[]> {
    try {
      const geoidModels = [
        {
          code: "GEOID18",
          name: "GEOID18",
          type: "geoid" as const,
          recommended: true,
          description: "Current NOAA geoid model for CONUS (2019)"
        },
        {
          code: "GEOID12B",
          name: "GEOID12B",
          type: "geoid" as const,
          recommended: false,
          description: "Previous NOAA geoid model for CONUS (2012)"
        },
        {
          code: "GEOID09",
          name: "GEOID09",
          type: "geoid" as const,
          recommended: false,
          description: "Legacy NOAA geoid model for CONUS (2009)"
        },
        {
          code: "GEOID03",
          name: "GEOID03",
          type: "geoid" as const,
          recommended: false,
          description: "Legacy NOAA geoid model for CONUS (2003)"
        }
      ];

      return geoidModels;
    } catch (error) {
      console.error('Error getting geoid models:', error);
      return [];
    }
  },

  /**
   * Get detailed information about a spatial reference system
   */
  async getSpatialReferenceDetails(epsgCode: number): Promise<ArcGISSpatialReference | null> {
    try {
      // Use our Next.js API proxy to avoid CORS issues
      const response = await fetch(`/api/crs/${epsgCode}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          wkid: epsgCode,
          latestWkid: epsgCode,
          name: data.name || `EPSG:${epsgCode}`,
          description: data.area || data.scope
        };
      }

      // Fallback to basic info if external API fails
      return {
        wkid: epsgCode,
        latestWkid: epsgCode,
        name: `EPSG:${epsgCode}`
      };
    } catch (error) {
      console.warn(`Failed to get details for EPSG:${epsgCode}:`, error);
      return {
        wkid: epsgCode,
        latestWkid: epsgCode,
        name: `EPSG:${epsgCode}`
      };
    }
  },

  /**
   * Check if a horizontal CRS is recommended for typical surveying work
   */
  isRecommendedHorizontal(epsgCode: number): boolean {
    // Recommend Indiana state plane coordinates in US Survey Feet
    const recommendedCodes = [2965, 2966, 6342, 6343]; // Indiana East/West in ftUS
    return recommendedCodes.includes(epsgCode);
  },

  /**
   * Get fallback CRS options if API calls fail
   */
  getFallbackCRSOptions(): {
    horizontal: CRSOption[];
    vertical: CRSOption[];
    geoid: CRSOption[];
  } {
    return {
      horizontal: [
        {
          code: "EPSG:2965",
          name: "NAD83 / Indiana East (ftUS)",
          type: "horizontal",
          recommended: true,
          description: "Indiana State Plane East Zone in US Survey Feet"
        },
        {
          code: "EPSG:2966",
          name: "NAD83 / Indiana West (ftUS)",
          type: "horizontal",
          recommended: true,
          description: "Indiana State Plane West Zone in US Survey Feet"
        },
        {
          code: "EPSG:4326",
          name: "WGS84",
          type: "horizontal",
          recommended: false,
          description: "World Geodetic System 1984"
        },
        {
          code: "EPSG:4269",
          name: "NAD83",
          type: "horizontal",
          recommended: false,
          description: "North American Datum 1983"
        }
      ],
      vertical: [
        {
          code: "EPSG:6360",
          name: "NAVD88 height (ftUS)",
          type: "vertical",
          recommended: true,
          description: "North American Vertical Datum of 1988 (US Survey Feet)"
        },
        {
          code: "EPSG:5703",
          name: "NAVD88 height",
          type: "vertical",
          recommended: false,
          description: "North American Vertical Datum of 1988 (meters)"
        }
      ],
      geoid: [
        {
          code: "GEOID18",
          name: "GEOID18",
          type: "geoid",
          recommended: true,
          description: "Current NOAA geoid model for CONUS (2019)"
        },
        {
          code: "GEOID12B",
          name: "GEOID12B",
          type: "geoid",
          recommended: false,
          description: "Previous NOAA geoid model for CONUS (2012)"
        }
      ]
    };
  },
};
