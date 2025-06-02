
// Service for parsing .proj files and extracting CRS information
export interface ProjFileData {
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
   * Fetch and parse a .proj file for a given job number
   */
  async fetchProjFile(jobNumber: string): Promise<ProjFileData | null> {
    try {
      const response = await fetch(`http://localhost:4400/pointclouds/${jobNumber}/${jobNumber}.proj`);
      if (!response.ok) {
        console.log(`No .proj file found for job ${jobNumber}`);
        return null;
      }
      
      const content = await response.text();
      return this.parseProjFile(content);
    } catch (error) {
      console.error(`Error fetching .proj file for job ${jobNumber}:`, error);
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
   * Get location information from .proj file parameters
   */
  getLocationFromProj(projData: ProjFileData): { latitude?: number; longitude?: number } | null {
    try {
      // Extract central meridian and latitude of origin
      const centralMeridian = projData.parameters['central_meridian'];
      const latitudeOfOrigin = projData.parameters['latitude_of_origin'];
      
      if (centralMeridian !== undefined && latitudeOfOrigin !== undefined) {
        return {
          longitude: centralMeridian,
          latitude: latitudeOfOrigin
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting location from .proj file:', error);
      return null;
    }
  }
};
