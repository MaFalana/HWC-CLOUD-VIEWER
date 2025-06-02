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
  deprecated: boolean;
}

interface MapTilerResponse {
  results: MapTilerResult[];
  total: number;
}

export const crsService = {
  /**
   * Search for CRS using static data first, then MapTiler API if needed
   */
  async searchCRS(query: string): Promise<CRSOption[]> {
    try {
      // First get all static Indiana CRS data
      const staticData = await this.getStaticIndianaCRS();
      
      // Filter static data based on search query
      const filteredStatic = staticData.filter(crs => 
        crs.name.toLowerCase().includes(query.toLowerCase()) ||
        crs.code.toLowerCase().includes(query.toLowerCase()) ||
        (crs.description && crs.description.toLowerCase().includes(query.toLowerCase()))
      );

      // If we have good results from static data, return them
      if (filteredStatic.length > 0) {
        return filteredStatic.sort((a, b) => {
          if (a.recommended && !b.recommended) return -1;
          if (!a.recommended && b.recommended) return 1;
          return a.name.localeCompare(b.name);
        });
      }

      // If no static results, try MapTiler API
      try {
        const response = await fetch(`/api/maptiler/search?query=${encodeURIComponent(query)}`, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data: MapTilerResponse = await response.json();
          
          // Process MapTiler results and convert to CRSOption format
          const newResults: CRSOption[] = data.results
            .filter(result => 
              result.id && 
              result.name && 
              !result.deprecated &&
              (result.area?.toLowerCase().includes('indiana') || 
               result.name.toLowerCase().includes('indiana') ||
               result.name.toLowerCase().includes('ingcs'))
            )
            .map(result => ({
              code: `${result.id.authority}:${result.id.code}`,
              name: result.name,
              type: "horizontal" as const,
              recommended: this.isRecommendedCRS(result.id.authority, result.id.code),
              description: result.area || result.name
            }));

          return newResults.sort((a, b) => {
            if (a.recommended && !b.recommended) return -1;
            if (!a.recommended && b.recommended) return 1;
            return a.name.localeCompare(b.name);
          });
        }
      } catch (apiError) {
        console.warn('MapTiler API request failed:', apiError);
      }

      // Return empty array if no results found
      return [];

    } catch (error) {
      console.error('Error searching CRS:', error);
      return [];
    }
  },

  /**
   * Get all CRS options (static data + cached)
   */
  async getAllCRSOptions(): Promise<{ horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] }> {
    try {
      const horizontal = await this.getStaticIndianaCRS();
      const vertical = await this.getVerticalCRS();
      const geoid = await this.getGeoidModels();

      return {
        horizontal,
        vertical,
        geoid
      };
    } catch (error) {
      console.error('Error getting CRS options:', error);
      return this.getFallbackCRS();
    }
  },

  /**
   * Get static Indiana CRS data from JSON file
   */
  async getStaticIndianaCRS(): Promise<CRSOption[]> {
    try {
      const indianaEpsgData = await import("@/data/indianaEpsgCodes.json");
      return indianaEpsgData.horizontal as CRSOption[];
    } catch (error) {
      console.error('Error loading static Indiana CRS data:', error);
      return this.getFallbackCRS().horizontal;
    }
  },

  /**
   * Get vertical CRS options
   */
  async getVerticalCRS(): Promise<CRSOption[]> {
    try {
      const indianaEpsgData = await import("@/data/indianaEpsgCodes.json");
      return indianaEpsgData.vertical as CRSOption[];
    } catch (error) {
      console.error('Error loading vertical CRS data:', error);
      return this.getFallbackCRS().vertical;
    }
  },

  /**
   * Get geoid model options
   */
  async getGeoidModels(): Promise<CRSOption[]> {
    try {
      const indianaEpsgData = await import("@/data/indianaEpsgCodes.json");
      return indianaEpsgData.geoid as CRSOption[];
    } catch (error) {
      console.error('Error loading geoid model data:', error);
      return this.getFallbackCRS().geoid;
    }
  },

  /**
   * Get cached CRS data
   */
  async getCachedCRS(): Promise<{ horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] }> {
    try {
      const cacheData = await import("@/data/crsCache.json");
      return {
        horizontal: cacheData.horizontal as CRSOption[],
        vertical: cacheData.vertical as CRSOption[],
        geoid: cacheData.geoid as CRSOption[]
      };
    } catch (error) {
      console.error('Error loading cached CRS:', error);
      return this.getFallbackCRS();
    }
  },

  /**
   * Cache CRS results (Note: In a real app, this would write to a database or file system)
   */
  async cacheCRS(newResults: CRSOption[]): Promise<void> {
    try {
      // In a browser environment, we can't write to files
      // This would typically be handled by a server endpoint
      console.log('Would cache CRS results:', newResults);
      
      // For now, we'll store in localStorage as a temporary cache
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
        2965, 2966, // Indiana State Plane East/West (ftUS)
        6459, 6461, // Indiana State Plane East/West NAD83(2011) (ftUS)
        3613, // Vanderburgh County
        7328  // Johnson-Marion County
      ];
      return recommendedCodes.includes(code);
    }
    return false;
  },

  /**
   * Get fallback CRS options
   */
  getFallbackCRS(): { horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] } {
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
          code: "EPSG:3613",
          name: "NAD83 / InGCS Vanderburgh (ftUS)",
          type: "horizontal",
          recommended: true,
          description: "Indiana Geographic Coordinate System - Vanderburgh County (US Survey Feet)"
        },
        {
          code: "EPSG:7328",
          name: "NAD83(2011) / InGCS Johnson-Marion (ftUS)",
          type: "horizontal",
          recommended: false,
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