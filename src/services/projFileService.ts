
// Service for parsing .proj files and extracting CRS information

interface ProjFileData {
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

export const projFileService = {
  /**
   * Parse a .proj file content and extract CRS information
   */
  parseProjFile(content: string): ProjFileData | null {
    try {
      // Remove extra whitespace and normalize the content
      const normalized = content.trim().replace(/\s+/g, ' ');
      
      // Extract PROJCS name
      const projcsMatch = normalized.match(/PROJCS\["([^"]+)"/);
      const projcs = projcsMatch ? projcsMatch[1] : '';
      
      // Extract GEOGCS name
      const geogcsMatch = normalized.match(/GEOGCS\["([^"]+)"/);
      const geogcs = geogcsMatch ? geogcsMatch[1] : '';
      
      // Extract DATUM name
      const datumMatch = normalized.match(/DATUM\["([^"]+)"/);
      const datum = datumMatch ? datumMatch[1] : '';
      
      // Extract SPHEROID name
      const spheroidMatch = normalized.match(/SPHEROID\["([^"]+)"/);
      const spheroid = spheroidMatch ? spheroidMatch[1] : '';
      
      // Extract PROJECTION name
      const projectionMatch = normalized.match(/PROJECTION\["([^"]+)"/);
      const projection = projectionMatch ? projectionMatch[1] : '';
      
      // Extract UNIT name
      const unitMatch = normalized.match(/UNIT\["([^"]+)"/);
      const unit = unitMatch ? unitMatch[1] : '';
      
      // Extract AUTHORITY and EPSG code
      const authorityMatch = normalized.match(/AUTHORITY\["EPSG","(\d+)"\]/);
      const epsgCode = authorityMatch ? `EPSG:${authorityMatch[1]}` : undefined;
      const authority = authorityMatch ? authorityMatch[1] : '';
      
      // Extract parameters
      const parameters: Record<string, number> = {};
      const parameterMatches = normalized.matchAll(/PARAMETER\["([^"]+)",([^\]]+)\]/g);
      for (const match of parameterMatches) {
        const paramName = match[1];
        const paramValue = parseFloat(match[2]);
        if (!isNaN(paramValue)) {
          parameters[paramName] = paramValue;
        }
      }
      
      return {
        projcs,
        geogcs,
        datum,
        spheroid,
        projection,
        parameters,
        unit,
        authority,
        epsgCode
      };
    } catch (error) {
      console.error('Error parsing .proj file:', error);
      return null;
    }
  },

  /**
   * Fetch and parse a .prj file for a given job number
   */
  async fetchProjFile(jobNumber: string): Promise<ProjFileData | null> {
    try {
      const response = await fetch(`https://hwc-backend-server.vercel.app/pointclouds/${jobNumber}/${jobNumber}.prj`);
      if (!response.ok) {
        console.log(`No .prj file found for job ${jobNumber}`);
        return null;
      }
      
      const content = await response.text();
      return this.parseProjFile(content);
    } catch (error) {
      console.error(`Error fetching .prj file for job ${jobNumber}:`, error);
      return null;
    }
  },

  /**
   * Convert .proj file data to CRS format used in the application
   */
  projDataToCRS(projData: ProjFileData): { horizontal: string; vertical?: string; geoidModel?: string } {
    const crs: { horizontal: string; vertical?: string; geoidModel?: string } = {
      horizontal: projData.epsgCode || projData.projcs
    };

    // Try to determine vertical CRS based on unit and datum
    if (projData.unit.toLowerCase().includes('foot') || projData.unit.toLowerCase().includes('ftus')) {
      if (projData.datum.includes('NAD83')) {
        crs.vertical = 'EPSG:6360'; // NAVD88 height (ftUS)
      } else {
        crs.vertical = 'EPSG:5702'; // NGVD29 height (ftUS)
      }
    }

    // Try to determine geoid model based on datum
    if (projData.datum.includes('2011')) {
      crs.geoidModel = 'GEOID12B';
    } else if (projData.datum.includes('HARN')) {
      crs.geoidModel = 'GEOID09';
    }

    return crs;
  },

  /**
   * Get location information from .proj file parameters using ArcGIS REST API
   */
  async getLocationFromProj(projData: ProjFileData): Promise<{ latitude?: number; longitude?: number } | null> {
    try {
      // Fallback to improved approximation without ArcGIS
      const centralMeridian = projData.parameters['central_meridian'];
      const latitudeOfOrigin = projData.parameters['latitude_of_origin'];
      const falseEasting = projData.parameters['false_easting'];
      const falseNorthing = projData.parameters['false_northing'];
      
      // For most state plane coordinate systems, we can use the central meridian and latitude of origin
      // as a reasonable approximation of the project location
      if (centralMeridian !== undefined && latitudeOfOrigin !== undefined) {
        // For Indiana projections, adjust the location based on the specific zone
        if (projData.projcs.toLowerCase().includes('indiana')) {
          // Indiana has multiple zones, adjust based on central meridian
          let adjustedLat = latitudeOfOrigin;
          let adjustedLon = centralMeridian;
          
          // Adjust for typical project locations within the zone
          if (centralMeridian === -87.55) { // Vanderburgh County
            adjustedLat = 37.9; // Evansville area
            adjustedLon = -87.5;
          } else if (centralMeridian === -86.5) { // Indiana West
            adjustedLat = 39.7; // Indianapolis area
            adjustedLon = -86.2;
          } else if (centralMeridian === -85.5) { // Indiana East
            adjustedLat = 40.5; // Fort Wayne area
            adjustedLon = -85.2;
          }
          
          return {
            latitude: adjustedLat,
            longitude: adjustedLon
          };
        }
        
        return {
          longitude: centralMeridian,
          latitude: latitudeOfOrigin
        };
      }
      
      // If we have false easting/northing, try to derive location from projection parameters
      if (falseEasting !== undefined && falseNorthing !== undefined) {
        // For Indiana state plane coordinates, use improved conversion
        if (projData.projcs.toLowerCase().includes('indiana')) {
          // Use the central meridian and latitude of origin if available
          if (centralMeridian !== undefined && latitudeOfOrigin !== undefined) {
            return {
              latitude: latitudeOfOrigin + 1.5, // Offset to typical project area
              longitude: centralMeridian + 0.5
            };
          }
          
          // Fallback to general Indiana location
          return {
            latitude: 39.7,
            longitude: -86.2
          };
        }
      }
      
      // Extract location from EPSG code if available
      if (projData.epsgCode) {
        // Handle common Indiana EPSG codes
        if (projData.epsgCode === 'EPSG:2965') { // Indiana West
          return { latitude: 39.7, longitude: -86.5 };
        } else if (projData.epsgCode === 'EPSG:2966') { // Indiana East
          return { latitude: 40.0, longitude: -85.5 };
        } else if (projData.epsgCode === 'EPSG:3613') { // Vanderburgh County
          return { latitude: 37.9747, longitude: -87.5558 };
        }
      }
      
      // Extract location from projection name if available
      if (projData.projcs) {
        if (projData.projcs.includes('Vanderburgh')) {
          return { latitude: 37.9747, longitude: -87.5558 };
        } else if (projData.projcs.includes('West')) {
          return { latitude: 39.7, longitude: -86.5 };
        } else if (projData.projcs.includes('East')) {
          return { latitude: 40.0, longitude: -85.5 };
        } else if (projData.projcs.includes('Indiana')) {
          return { latitude: 39.7, longitude: -86.2 };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting location from .proj file:', error);
      return null;
    }
  }
};
