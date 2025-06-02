
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
   * Search for CRS using MapTiler API and cache results
   */
  async searchCRS(query: string): Promise<CRSOption[]> {
    try {
      // First check cache
      const cached = await this.getCachedCRS();
      const existingResults = cached.horizontal.filter(crs => 
        crs.name.toLowerCase().includes(query.toLowerCase()) ||
        crs.code.toLowerCase().includes(query.toLowerCase())
      );

      // If we have cached results for this query, return them
      if (existingResults.length > 0) {
        return existingResults;
      }

      // Query MapTiler API
      const response = await fetch(`/api/maptiler/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('MapTiler API request failed, using cached data');
        return existingResults;
      }

      const data: MapTilerResponse = await response.json();
      
      // Process results and convert to CRSOption format
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

      // Cache new results
      if (newResults.length > 0) {
        await this.cacheCRS(newResults);
      }

      // Return combined results (existing + new)
      const allResults = [...existingResults, ...newResults];
      
      // Remove duplicates based on code
      const uniqueResults = allResults.filter((item, index, self) => 
        index === self.findIndex(t => t.code === item.code)
      );

      return uniqueResults.sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      console.error('Error searching CRS:', error);
      // Return cached data as fallback
      const cached = await this.getCachedCRS();
      return cached.horizontal;
    }
  },

  /**
   * Get all CRS options (cached + static)
   */
  async getAllCRSOptions(): Promise<{ horizontal: CRSOption[]; vertical: CRSOption[]; geoid: CRSOption[] }> {
    try {
      const cached = await this.getCachedCRS();
      
      // If cache is empty, populate with Indiana-specific searches
      if (cached.horizontal.length === 0) {
        await this.populateIndianaCache();
        return await this.getCachedCRS();
      }

      return cached;
    } catch (error) {
      console.error('Error getting CRS options:', error);
      return this.getFallbackCRS();
    }
  },

  /**
   * Populate cache with Indiana-specific CRS
   */
  async populateIndianaCache(): Promise<void> {
    const searchTerms = [
      'Indiana State Plane',
      'InGCS',
      'Indiana Geographic Coordinate System',
      'NAD83 Indiana',
      'NAD83(2011) Indiana'
    ];

    for (const term of searchTerms) {
      try {
        await this.searchCRS(term);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Failed to search for "${term}":`, error);
      }
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
