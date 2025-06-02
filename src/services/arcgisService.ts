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
   * Get coordinate reference systems with enhanced epsg.io integration
   */
  async getCRSOptions(): Promise<{ horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] }> {
    try {
      // Load from static JSON file instead of API calls
      const indianaEpsgData = await import("@/data/indianaEpsgCodes.json");
      
      // Cast the imported data to the correct types
      return {
        horizontal: indianaEpsgData.horizontal as CRSOption[],
        vertical: indianaEpsgData.vertical as CRSOption[],
        geoid: indianaEpsgData.geoid as CRSOption[]
      };
    } catch (error) {
      console.error("Error loading Indiana EPSG codes:", error);
      return this.getFallbackCRSOptions();
    }
  },

  /**
   * Get horizontal CRS options with detailed information from static JSON
   */
  async getHorizontalCRSWithDetails(): Promise<CRSOption[]> {
    try {
      const indianaEpsgData = await import("@/data/indianaEpsgCodes.json");
      return indianaEpsgData.horizontal as CRSOption[];
    } catch (error) {
      console.error('Error loading horizontal CRS from JSON:', error);
      return this.getFallbackCRSOptions().horizontal;
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
   * Get detailed information about a spatial reference system from epsg.io
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
          description: data.area || data.scope || data.remarks
        };
      }

      // Fallback to basic info if external API fails
      return {
        wkid: epsgCode,
        latestWkid: epsgCode,
        name: this.getKnownCRSName(epsgCode) || `EPSG:${epsgCode}`,
        description: this.getKnownCRSDescription(epsgCode)
      };
    } catch (error) {
      console.warn(`Failed to get details for EPSG:${epsgCode}:`, error);
      return {
        wkid: epsgCode,
        latestWkid: epsgCode,
        name: this.getKnownCRSName(epsgCode) || `EPSG:${epsgCode}`,
        description: this.getKnownCRSDescription(epsgCode)
      };
    }
  },

  /**
   * Check if a horizontal CRS is recommended for Indiana surveying work
   */
  isRecommendedHorizontal(epsgCode: number): boolean {
    // Recommend Indiana state plane coordinates in US Survey Feet and Vanderburgh County
    const recommendedCodes = [2965, 2966, 6459, 6461, 3613]; // Indiana East/West in ftUS + Vanderburgh
    return recommendedCodes.includes(epsgCode);
  },

  /**
   * Get fallback CRS options if API calls fail
   */
  getFallbackCRSOptions(): { horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] } {
    return {
      horizontal: [
        // Indiana State Plane Systems
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
          code: "EPSG:6459",
          name: "NAD83(2011) / Indiana East (ftUS)",
          type: "horizontal",
          recommended: true,
          description: "Indiana State Plane East Zone NAD83(2011) in US Survey Feet"
        },
        {
          code: "EPSG:6461",
          name: "NAD83(2011) / Indiana West (ftUS)",
          type: "horizontal",
          recommended: true,
          description: "Indiana State Plane West Zone NAD83(2011) in US Survey Feet"
        },
        // Indiana County Coordinate Systems
        {
          code: "EPSG:3532",
          name: "NAD83 / InGCS Adams (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Adams County (US Survey Feet)"
        },
        {
          code: "EPSG:3533",
          name: "NAD83 / InGCS Allen (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Allen County (US Survey Feet)"
        },
        {
          code: "EPSG:3534",
          name: "NAD83 / InGCS Bartholomew (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Bartholomew County (US Survey Feet)"
        },
        {
          code: "EPSG:3535",
          name: "NAD83 / InGCS Benton (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Benton County (US Survey Feet)"
        },
        {
          code: "EPSG:3536",
          name: "NAD83 / InGCS Blackford (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Blackford County (US Survey Feet)"
        },
        {
          code: "EPSG:3537",
          name: "NAD83 / InGCS Boone (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Boone County (US Survey Feet)"
        },
        {
          code: "EPSG:3538",
          name: "NAD83 / InGCS Brown (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Brown County (US Survey Feet)"
        },
        {
          code: "EPSG:3539",
          name: "NAD83 / InGCS Carroll (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Carroll County (US Survey Feet)"
        },
        {
          code: "EPSG:3540",
          name: "NAD83 / InGCS Cass (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Cass County (US Survey Feet)"
        },
        {
          code: "EPSG:3541",
          name: "NAD83 / InGCS Clark (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Clark County (US Survey Feet)"
        },
        {
          code: "EPSG:3542",
          name: "NAD83 / InGCS Clay (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Clay County (US Survey Feet)"
        },
        {
          code: "EPSG:3543",
          name: "NAD83 / InGCS Clinton (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Clinton County (US Survey Feet)"
        },
        {
          code: "EPSG:3544",
          name: "NAD83 / InGCS Crawford (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Crawford County (US Survey Feet)"
        },
        {
          code: "EPSG:3545",
          name: "NAD83 / InGCS Daviess (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Daviess County (US Survey Feet)"
        },
        {
          code: "EPSG:3546",
          name: "NAD83 / InGCS Dearborn (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Dearborn County (US Survey Feet)"
        },
        {
          code: "EPSG:3547",
          name: "NAD83 / InGCS Decatur (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Decatur County (US Survey Feet)"
        },
        {
          code: "EPSG:3548",
          name: "NAD83 / InGCS DeKalb (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - DeKalb County (US Survey Feet)"
        },
        {
          code: "EPSG:3549",
          name: "NAD83 / InGCS Delaware (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Delaware County (US Survey Feet)"
        },
        {
          code: "EPSG:3550",
          name: "NAD83 / InGCS Dubois (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Dubois County (US Survey Feet)"
        },
        {
          code: "EPSG:3551",
          name: "NAD83 / InGCS Elkhart (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Elkhart County (US Survey Feet)"
        },
        {
          code: "EPSG:3552",
          name: "NAD83 / InGCS Fayette (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Fayette County (US Survey Feet)"
        },
        {
          code: "EPSG:3553",
          name: "NAD83 / InGCS Floyd (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Floyd County (US Survey Feet)"
        },
        {
          code: "EPSG:3554",
          name: "NAD83 / InGCS Fountain (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Fountain County (US Survey Feet)"
        },
        {
          code: "EPSG:3555",
          name: "NAD83 / InGCS Franklin (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Franklin County (US Survey Feet)"
        },
        {
          code: "EPSG:3556",
          name: "NAD83 / InGCS Fulton (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Fulton County (US Survey Feet)"
        },
        {
          code: "EPSG:3557",
          name: "NAD83 / InGCS Gibson (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Gibson County (US Survey Feet)"
        },
        {
          code: "EPSG:3558",
          name: "NAD83 / InGCS Grant (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Grant County (US Survey Feet)"
        },
        {
          code: "EPSG:3559",
          name: "NAD83 / InGCS Greene (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Greene County (US Survey Feet)"
        },
        {
          code: "EPSG:3560",
          name: "NAD83 / InGCS Hamilton (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Hamilton County (US Survey Feet)"
        },
        {
          code: "EPSG:3561",
          name: "NAD83 / InGCS Hancock (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Hancock County (US Survey Feet)"
        },
        {
          code: "EPSG:3562",
          name: "NAD83 / InGCS Harrison (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Harrison County (US Survey Feet)"
        },
        {
          code: "EPSG:3563",
          name: "NAD83 / InGCS Hendricks (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Hendricks County (US Survey Feet)"
        },
        {
          code: "EPSG:3564",
          name: "NAD83 / InGCS Henry (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Henry County (US Survey Feet)"
        },
        {
          code: "EPSG:3565",
          name: "NAD83 / InGCS Howard (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Howard County (US Survey Feet)"
        },
        {
          code: "EPSG:3566",
          name: "NAD83 / InGCS Huntington (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Huntington County (US Survey Feet)"
        },
        {
          code: "EPSG:3567",
          name: "NAD83 / InGCS Jackson (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Jackson County (US Survey Feet)"
        },
        {
          code: "EPSG:3568",
          name: "NAD83 / InGCS Jasper (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Jasper County (US Survey Feet)"
        },
        {
          code: "EPSG:3569",
          name: "NAD83 / InGCS Jay (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Jay County (US Survey Feet)"
        },
        {
          code: "EPSG:3570",
          name: "NAD83 / InGCS Jefferson (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Jefferson County (US Survey Feet)"
        },
        {
          code: "EPSG:3571",
          name: "NAD83 / InGCS Jennings (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Jennings County (US Survey Feet)"
        },
        {
          code: "EPSG:3572",
          name: "NAD83 / InGCS Johnson (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Johnson County (US Survey Feet)"
        },
        {
          code: "EPSG:3573",
          name: "NAD83 / InGCS Knox (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Knox County (US Survey Feet)"
        },
        {
          code: "EPSG:3574",
          name: "NAD83 / InGCS Kosciusko (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Kosciusko County (US Survey Feet)"
        },
        {
          code: "EPSG:3575",
          name: "NAD83 / InGCS LaGrange (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - LaGrange County (US Survey Feet)"
        },
        {
          code: "EPSG:3576",
          name: "NAD83 / InGCS Lake (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Lake County (US Survey Feet)"
        },
        {
          code: "EPSG:3577",
          name: "NAD83 / InGCS LaPorte (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - LaPorte County (US Survey Feet)"
        },
        {
          code: "EPSG:3578",
          name: "NAD83 / InGCS Lawrence (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Lawrence County (US Survey Feet)"
        },
        {
          code: "EPSG:3579",
          name: "NAD83 / InGCS Madison (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Madison County (US Survey Feet)"
        },
        {
          code: "EPSG:3580",
          name: "NAD83 / InGCS Marion (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Marion County (US Survey Feet)"
        },
        {
          code: "EPSG:3581",
          name: "NAD83 / InGCS Marshall (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Marshall County (US Survey Feet)"
        },
        {
          code: "EPSG:3582",
          name: "NAD83 / InGCS Martin (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Martin County (US Survey Feet)"
        },
        {
          code: "EPSG:3583",
          name: "NAD83 / InGCS Miami (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Miami County (US Survey Feet)"
        },
        {
          code: "EPSG:3584",
          name: "NAD83 / InGCS Monroe (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Monroe County (US Survey Feet)"
        },
        {
          code: "EPSG:3585",
          name: "NAD83 / InGCS Montgomery (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Montgomery County (US Survey Feet)"
        },
        {
          code: "EPSG:3586",
          name: "NAD83 / InGCS Morgan (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Morgan County (US Survey Feet)"
        },
        {
          code: "EPSG:3587",
          name: "NAD83 / InGCS Newton (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Newton County (US Survey Feet)"
        },
        {
          code: "EPSG:3588",
          name: "NAD83 / InGCS Noble (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Noble County (US Survey Feet)"
        },
        {
          code: "EPSG:3589",
          name: "NAD83 / InGCS Ohio (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Ohio County (US Survey Feet)"
        },
        {
          code: "EPSG:3590",
          name: "NAD83 / InGCS Orange (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Orange County (US Survey Feet)"
        },
        {
          code: "EPSG:3591",
          name: "NAD83 / InGCS Owen (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Owen County (US Survey Feet)"
        },
        {
          code: "EPSG:3592",
          name: "NAD83 / InGCS Parke (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Parke County (US Survey Feet)"
        },
        {
          code: "EPSG:3593",
          name: "NAD83 / InGCS Perry (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Perry County (US Survey Feet)"
        },
        {
          code: "EPSG:3594",
          name: "NAD83 / InGCS Pike (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Pike County (US Survey Feet)"
        },
        {
          code: "EPSG:3595",
          name: "NAD83 / InGCS Porter (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Porter County (US Survey Feet)"
        },
        {
          code: "EPSG:3596",
          name: "NAD83 / InGCS Posey (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Posey County (US Survey Feet)"
        },
        {
          code: "EPSG:3597",
          name: "NAD83 / InGCS Pulaski (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Pulaski County (US Survey Feet)"
        },
        {
          code: "EPSG:3598",
          name: "NAD83 / InGCS Putnam (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Putnam County (US Survey Feet)"
        },
        {
          code: "EPSG:3599",
          name: "NAD83 / InGCS Randolph (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Randolph County (US Survey Feet)"
        },
        {
          code: "EPSG:3600",
          name: "NAD83 / InGCS Ripley (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Ripley County (US Survey Feet)"
        },
        {
          code: "EPSG:3601",
          name: "NAD83 / InGCS Rush (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Rush County (US Survey Feet)"
        },
        {
          code: "EPSG:3602",
          name: "NAD83 / InGCS Scott (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Scott County (US Survey Feet)"
        },
        {
          code: "EPSG:3603",
          name: "NAD83 / InGCS Shelby (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Shelby County (US Survey Feet)"
        },
        {
          code: "EPSG:3604",
          name: "NAD83 / InGCS Spencer (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Spencer County (US Survey Feet)"
        },
        {
          code: "EPSG:3605",
          name: "NAD83 / InGCS Starke (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Starke County (US Survey Feet)"
        },
        {
          code: "EPSG:3606",
          name: "NAD83 / InGCS Steuben (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Steuben County (US Survey Feet)"
        },
        {
          code: "EPSG:3607",
          name: "NAD83 / InGCS St Joseph (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - St Joseph County (US Survey Feet)"
        },
        {
          code: "EPSG:3608",
          name: "NAD83 / InGCS Sullivan (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Sullivan County (US Survey Feet)"
        },
        {
          code: "EPSG:3609",
          name: "NAD83 / InGCS Switzerland (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Switzerland County (US Survey Feet)"
        },
        {
          code: "EPSG:3610",
          name: "NAD83 / InGCS Tippecanoe (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Tippecanoe County (US Survey Feet)"
        },
        {
          code: "EPSG:3611",
          name: "NAD83 / InGCS Tipton (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Tipton County (US Survey Feet)"
        },
        {
          code: "EPSG:3612",
          name: "NAD83 / InGCS Union (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Union County (US Survey Feet)"
        },
        {
          code: "EPSG:3613",
          name: "NAD83 / InGCS Vanderburgh (ftUS)",
          type: "horizontal",
          recommended: true,
          description: "Indiana Geographic Coordinate System - Vanderburgh County (US Survey Feet)"
        },
        {
          code: "EPSG:3614",
          name: "NAD83 / InGCS Vermillion (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Vermillion County (US Survey Feet)"
        },
        {
          code: "EPSG:3615",
          name: "NAD83 / InGCS Vigo (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Vigo County (US Survey Feet)"
        },
        {
          code: "EPSG:3616",
          name: "NAD83 / InGCS Wabash (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Wabash County (US Survey Feet)"
        },
        {
          code: "EPSG:3617",
          name: "NAD83 / InGCS Warren (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Warren County (US Survey Feet)"
        },
        {
          code: "EPSG:3618",
          name: "NAD83 / InGCS Warrick (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Warrick County (US Survey Feet)"
        },
        {
          code: "EPSG:3619",
          name: "NAD83 / InGCS Washington (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Washington County (US Survey Feet)"
        },
        {
          code: "EPSG:3620",
          name: "NAD83 / InGCS Wayne (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Wayne County (US Survey Feet)"
        },
        {
          code: "EPSG:3621",
          name: "NAD83 / InGCS Wells (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Wells County (US Survey Feet)"
        },
        {
          code: "EPSG:3622",
          name: "NAD83 / InGCS White (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - White County (US Survey Feet)"
        },
        {
          code: "EPSG:3623",
          name: "NAD83 / InGCS Whitley (ftUS)",
          type: "horizontal",
          recommended: false,
          description: "Indiana Geographic Coordinate System - Whitley County (US Survey Feet)"
        },
        // UTM Systems for Indiana
        {
          code: "EPSG:26916",
          name: "NAD83 / UTM zone 16N",
          type: "horizontal",
          recommended: false,
          description: "Universal Transverse Mercator Zone 16 North (NAD83)"
        },
        {
          code: "EPSG:32616",
          name: "WGS 84 / UTM zone 16N",
          type: "horizontal",
          recommended: false,
          description: "Universal Transverse Mercator Zone 16 North (WGS84)"
        },
        // Geographic Systems
        {
          code: "EPSG:4269",
          name: "NAD83",
          type: "horizontal",
          recommended: false,
          description: "North American Datum 1983 (Geographic)"
        },
        {
          code: "EPSG:4326",
          name: "WGS 84",
          type: "horizontal",
          recommended: false,
          description: "World Geodetic System 1984 (Geographic)"
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
        },
        {
          code: "EPSG:5714",
          name: "MSL height",
          type: "vertical",
          recommended: false,
          description: "Mean Sea Level height"
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
        },
        {
          code: "GEOID09",
          name: "GEOID09",
          type: "geoid",
          recommended: false,
          description: "Legacy NOAA geoid model for CONUS (2009)"
        }
      ]
    };
  },

  /**
   * Get known CRS names for common systems
   */
  getKnownCRSName(epsgCode: number): string | undefined {
    const knownNames: Record<number, string> = {
      4326: "WGS84",
      4269: "NAD83",
      4267: "NAD27",
      3857: "WGS 84 / Pseudo-Mercator",
      2965: "NAD83 / Indiana East (ftUS)",
      2966: "NAD83 / Indiana West (ftUS)",
      6342: "NAD83(2011) / Indiana East (ftUS)",
      6343: "NAD83(2011) / Indiana West (ftUS)",
      6458: "NAD83(2011) / Indiana East",
      6459: "NAD83(2011) / Indiana East (ftUS)",
      6460: "NAD83(2011) / Indiana West",
      6461: "NAD83(2011) / Indiana West (ftUS)",
      3532: "NAD83 / InGCS Vanderburgh (ftUS)",
      3533: "NAD83(2011) / InGCS Vanderburgh (ftUS)",
      26916: "NAD83 / UTM zone 16N",
      26917: "NAD83 / UTM zone 17N",
      32616: "WGS 84 / UTM zone 16N",
      32617: "WGS 84 / UTM zone 17N"
    };
    return knownNames[epsgCode];
  },

  /**
   * Get known CRS descriptions for common systems
   */
  getKnownCRSDescription(epsgCode: number): string | undefined {
    const knownDescriptions: Record<number, string> = {
      4326: "World Geodetic System 1984",
      4269: "North American Datum 1983",
      4267: "North American Datum 1927",
      3857: "Web Mercator projection",
      2965: "Indiana State Plane East Zone in US Survey Feet",
      2966: "Indiana State Plane West Zone in US Survey Feet",
      6342: "Indiana State Plane East Zone in US Survey Feet (NAD83 2011)",
      6343: "Indiana State Plane West Zone in US Survey Feet (NAD83 2011)",
      6458: "Indiana State Plane East Zone in meters (NAD83 2011)",
      6459: "Indiana State Plane East Zone in US Survey Feet (NAD83 2011)",
      6460: "Indiana State Plane West Zone in meters (NAD83 2011)",
      6461: "Indiana State Plane West Zone in US Survey Feet (NAD83 2011)",
      3532: "Indiana Geographic Coordinate System - Vanderburgh County (US Survey Feet)",
      3533: "Indiana Geographic Coordinate System - Vanderburgh County NAD83(2011) (US Survey Feet)",
      26916: "UTM Zone 16 North (NAD83)",
      26917: "UTM Zone 17 North (NAD83)",
      32616: "UTM Zone 16 North (WGS84)",
      32617: "UTM Zone 17 North (WGS84)"
    };
    return knownDescriptions[epsgCode];
  },
};
