import { CRSOption } from "@/types/project";

interface MapTilerResult {
  id: {
    authority: string;
    code: number;
  };
  kind: string;
  name: string;
  area?: string;
  unit?: string;
  bbox?: [number, number, number, number]; // [west, south, east, north]
  deprecated: boolean;
}

interface MapTilerResponse {
  results: MapTilerResult[];
  total: number;
  error?: string;
  message?: string;
  fallback?: boolean;
}

// Cache for storing fetched CRS data
let crsCache: { horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] } | null = null;

export const crsService = {
  /**
   * Search for CRS using MapTiler API, focusing on NAD83(2011) Indiana ftUS systems
   */
  async searchCRS(query: string): Promise<CRSOption[]> {
    try {
      // Simplify search query for better MapTiler compatibility
      const searchQuery = query.trim();
      
      const response = await fetch(`/api/maptiler/search?query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('MapTiler API request failed:', response.status);
        return this.getFallbackCRS().horizontal;
      }

      const data: MapTilerResponse = await response.json();
      
      // If MapTiler returned an error, use fallback
      if (data.error || data.fallback) {
        console.warn('MapTiler API returned error, using fallback CRS');
        return this.getFallbackCRS().horizontal;
      }
      
      // Process MapTiler results and convert to CRSOption format
      const results: CRSOption[] = data.results
        .filter(result => 
          result.id && 
          result.name && 
          !result.deprecated &&
          result.id.authority === 'EPSG' &&
          // Focus on NAD83(2011) systems or Indiana systems
          (result.name.toLowerCase().includes('nad83(2011)') ||
           result.name.toLowerCase().includes('indiana') ||
           result.name.toLowerCase().includes('ingcs')) &&
          // Prefer ftUS systems but allow others
          (result.unit === 'US survey foot' || 
           result.name.toLowerCase().includes('ftus') ||
           result.name.toLowerCase().includes('(ftus)') ||
           result.name.toLowerCase().includes('us feet') ||
           result.name.toLowerCase().includes('survey feet') ||
           result.name.toLowerCase().includes('indiana'))
        )
        .map(result => ({
          code: `EPSG:${result.id.code}`,
          name: result.name,
          type: "horizontal" as const,
          recommended: this.isRecommendedCRS(result.id.authority, result.id.code),
          description: result.area || result.name,
          bbox: result.bbox
        }));

      // Cache the results
      if (results.length > 0) {
        await this.cacheCRS(results);
      }

      // If no results from MapTiler, return fallback
      if (results.length === 0) {
        return this.getFallbackCRS().horizontal;
      }

      return results.sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      console.error('Error searching CRS:', error);
      return this.getFallbackCRS().horizontal;
    }
  },

  /**
   * Get all CRS options using MapTiler API with fallback
   */
  async getAllCRSOptions(): Promise<{ horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] }> {
    try {
      // Return cached data if available
      if (crsCache) {
        return crsCache;
      }

      // Try to fetch horizontal CRS from MapTiler API
      const horizontal = await this.fetchIndianaHorizontalCRS();
      const vertical = await this.getVerticalCRS();
      const geoid = await this.getGeoidModels();

      const result = {
        horizontal: horizontal.length > 0 ? horizontal : this.getFallbackCRS().horizontal,
        vertical,
        geoid
      };

      // Cache the result
      crsCache = result;
      
      return result;
    } catch (error) {
      console.error('Error getting CRS options:', error);
      return this.getFallbackCRS();
    }
  },

  /**
   * Fetch Indiana NAD83(2011) horizontal CRS systems from MapTiler API
   */
  async fetchIndianaHorizontalCRS(): Promise<CRSOption[]> {
    try {
      // Simplified queries that are more likely to work with MapTiler
      const queries = [
        'Indiana East',
        'Indiana West', 
        'InGCS',
        'Indiana State Plane',
        'NAD83 Indiana'
      ];

      const allResults: CRSOption[] = [];
      
      for (const query of queries) {
        try {
          const results = await this.searchCRS(query);
          
          // Add unique results
          results.forEach(result => {
            if (!allResults.find(existing => existing.code === result.code)) {
              allResults.push(result);
            }
          });
        } catch (error) {
          console.warn(`Failed to search for "${query}":`, error);
          continue;
        }
      }

      // Always ensure we have the essential NAD83(2011) Indiana systems
      const knownSystems = this.getFallbackCRS().horizontal;
      
      knownSystems.forEach(known => {
        if (!allResults.find(existing => existing.code === known.code)) {
          allResults.push(known);
        }
      });

      return allResults.sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      console.error('Error fetching Indiana horizontal CRS:', error);
      return this.getFallbackCRS().horizontal;
    }
  },

  /**
   * Get vertical CRS options
   */
  async getVerticalCRS(): Promise<CRSOption[]> {
    return [
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
        code: "EPSG:5701",
        name: "MSL height",
        type: "vertical",
        recommended: false,
        description: "Mean Sea Level height"
      },
      {
        code: "EPSG:5702",
        name: "NGVD29 height",
        type: "vertical",
        recommended: false,
        description: "National Geodetic Vertical Datum of 1929"
      }
    ];
  },

  /**
   * Get geoid model options
   */
  async getGeoidModels(): Promise<CRSOption[]> {
    return [
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
      },
      {
        code: "GEOID03",
        name: "GEOID03",
        type: "geoid",
        recommended: false,
        description: "Legacy NOAA geoid model for CONUS (2003)"
      }
    ];
  },

  /**
   * Get location from bbox data
   */
  getLocationFromBbox(bbox: [number, number, number, number]): { latitude: number; longitude: number; address: string } {
    // bbox format: [west, south, east, north]
    const [west, south, east, north] = bbox;
    
    // Calculate center point
    const latitude = (south + north) / 2;
    const longitude = (west + east) / 2;
    
    return {
      latitude,
      longitude,
      address: "Indiana"
    };
  },

  /**
   * Cache CRS results in localStorage
   */
  async cacheCRS(newResults: CRSOption[]): Promise<void> {
    try {
      const existing = localStorage.getItem('crs_cache');
      const cache = existing ? JSON.parse(existing) : { horizontal: [], vertical: [], geoid: [] };
      
      // Add new results, avoiding duplicates
      newResults.forEach(result => {
        if (!cache.horizontal.find((item: CRSOption) => item.code === result.code)) {
          cache.horizontal.push(result);
        }
      });

      localStorage.setItem('crs_cache', JSON.stringify(cache));
    } catch (error) {
      console.error('Error caching CRS:', error);
    }
  },

  /**
   * Check if a CRS is recommended for Indiana
   */
  isRecommendedCRS(authority: string, code: number): boolean {
    if (authority === 'EPSG') {
      const recommendedCodes = [
        6459, 6461, // Indiana State Plane East/West NAD83(2011) (ftUS)
        7328  // Johnson-Marion County NAD83(2011)
      ];
      return recommendedCodes.includes(code);
    }
    return false;
  },

  /**
   * Get fallback CRS options - NAD83(2011) systems only
   */
  getFallbackCRS(): { horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] } {
    return {
      horizontal: [
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
        {
          code: "EPSG:7328",
          name: "NAD83(2011) / InGCS Johnson-Marion (ftUS)",
          type: "horizontal",
          recommended: true,
          description: "Indiana Geographic Coordinate System - Johnson-Marion County NAD83(2011) (US Survey Feet)"
        }
      ],
      vertical: [
        {
          code: "EPSG:6360",
          name: "NAVD88 height (ftUS)",
          type: "vertical",
          recommended: true,
          description: "North American Vertical Datum of 1988 (US Survey Feet)"
        }
      ],
      geoid: [
        {
          code: "GEOID18",
          name: "GEOID18",
          type: "geoid",
          recommended: true,
          description: "Current NOAA geoid model for CONUS (2019)"
        }
      ]
    };
  }
};