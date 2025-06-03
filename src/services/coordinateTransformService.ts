
// Coordinate transformation service for converting between different CRS
// Primarily for converting InGCS county coordinates to WGS84 for web mapping

import indianaData from "@/data/Indiana.json";

interface TransformationParams {
  fromCRS: string;
  toCRS: string;
  coordinates: [number, number];
}

interface TransformedCoordinates {
  latitude: number;
  longitude: number;
  originalX: number;
  originalY: number;
  fromCRS: string;
  toCRS: string;
}

// Indiana State Plane coordinate system transformations
// These are approximate transformations for common Indiana county systems
const INDIANA_TRANSFORMATIONS: Record<string, {
  centralMeridian: number;
  latitudeOfOrigin: number;
  falseEasting: number;
  falseNorthing: number;
  scaleFactor: number;
}> = {
  // Marion County (Indianapolis) - EPSG:2965
  "EPSG:2965": {
    centralMeridian: -86.1666666666667,
    latitudeOfOrigin: 39.3333333333333,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  },
  // Vanderburgh County (Evansville) - EPSG:3613
  "EPSG:3613": {
    centralMeridian: -87.5,
    latitudeOfOrigin: 37.5,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  },
  // Allen County (Fort Wayne) - EPSG:3533
  "EPSG:3533": {
    centralMeridian: -85.0,
    latitudeOfOrigin: 41.0,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  },
  // St. Joseph County (South Bend) - EPSG:3607
  "EPSG:3607": {
    centralMeridian: -86.25,
    latitudeOfOrigin: 41.5,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  },
  // Monroe County (Bloomington) - EPSG:3584
  "EPSG:3584": {
    centralMeridian: -86.5,
    latitudeOfOrigin: 39.0,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  },
  // Lake County - EPSG:3580
  "EPSG:3580": {
    centralMeridian: -87.25,
    latitudeOfOrigin: 41.25,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  },
  // Hamilton County - EPSG:2966
  "EPSG:2966": {
    centralMeridian: -86.0,
    latitudeOfOrigin: 39.5,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  },
  // Indiana East - EPSG:6459
  "EPSG:6459": {
    centralMeridian: -85.5,
    latitudeOfOrigin: 40.0,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  },
  // Indiana West - EPSG:6461
  "EPSG:6461": {
    centralMeridian: -86.5,
    latitudeOfOrigin: 39.5,
    falseEasting: 240000,
    falseNorthing: 36000,
    scaleFactor: 1.000013
  }
};

// Convert degrees to radians
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

// Convert radians to degrees
const toDegrees = (radians: number): number => radians * (180 / Math.PI);

// Simplified inverse transverse Mercator projection
// This is an approximation for small areas like Indiana counties
const inverseTransverseMercator = (
  x: number,
  y: number,
  params: typeof INDIANA_TRANSFORMATIONS[string]
): [number, number] => {
  // Convert from US survey feet to meters (1 US survey foot = 0.3048006096012192 meters)
  const xMeters = (x - params.falseEasting) * 0.3048006096012192;
  const yMeters = (y - params.falseNorthing) * 0.3048006096012192;
  
  // Earth radius in meters
  const a = 6378137.0; // WGS84 semi-major axis
  
  // Central meridian and latitude of origin in radians
  const lon0 = toRadians(params.centralMeridian);
  const lat0 = toRadians(params.latitudeOfOrigin);
  
  // Scale factor
  const k0 = params.scaleFactor;
  
  // Simplified inverse calculation (approximation for small areas)
  const M0 = a * lat0; // Meridional arc at latitude of origin (simplified)
  const M = M0 + yMeters / k0;
  
  // Approximate latitude
  const lat = M / a;
  
  // Approximate longitude
  const lon = lon0 + (xMeters / (k0 * a * Math.cos(lat)));
  
  return [toDegrees(lat), toDegrees(lon)];
};

// Get transformation parameters for a given CRS code
const getTransformationParams = (crsCode: string): typeof INDIANA_TRANSFORMATIONS[string] | null => {
  // First check our predefined transformations
  if (INDIANA_TRANSFORMATIONS[crsCode]) {
    return INDIANA_TRANSFORMATIONS[crsCode];
  }
  
  // If not found, try to find it in the Indiana data
  const crsData = indianaData.find(item => `${item.id.authority}:${item.id.code}` === crsCode);
  if (crsData) {
    // Use the bbox to approximate the central meridian and latitude of origin
    const [minLon, minLat, maxLon, maxLat] = crsData.bbox;
    const centralMeridian = (minLon + maxLon) / 2;
    const latitudeOfOrigin = (minLat + maxLat) / 2;
    
    // Use standard values for other parameters
    return {
      centralMeridian,
      latitudeOfOrigin,
      falseEasting: 240000, // Standard for Indiana
      falseNorthing: 36000, // Standard for Indiana
      scaleFactor: 1.000013 // Standard for Indiana
    };
  }
  
  return null;
};

// Check if coordinates appear to be in a projected coordinate system
const isProjectedCoordinates = (lat: number, lon: number): boolean => {
  // If coordinates are very large (> 1000), they're likely projected coordinates
  // Geographic coordinates should be within [-180, 180] for longitude and [-90, 90] for latitude
  return Math.abs(lat) > 1000 || Math.abs(lon) > 1000;
};

// Transform coordinates using MapTiler API
const transformWithMapTiler = async (
  fromCRS: string,
  toCRS: string,
  coordinates: [number, number]
): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    // Extract EPSG code number from the full code (e.g., "EPSG:7366" -> "7366")
    const sourceCRS = fromCRS.split(":")[1];
    const targetCRS = toCRS.split(":")[1] || "4326"; // Default to WGS84 if not specified
    
    const [x, y] = coordinates;
    
    // Use the MapTiler API format with API key from environment or fallback
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || "3zy0Sl3tcfZaOQFhQD8J";
    const url = `https://api.maptiler.com/coordinates/transform/${x},${y}.json?s_srs=${sourceCRS}&t_srs=${targetCRS}&key=${apiKey}`;
    
    console.log(`Calling MapTiler API: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MapTiler API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`MapTiler API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("MapTiler API response:", data);
    
    // MapTiler returns [lon, lat] for geographic coordinates
    if (data && Array.isArray(data) && data.length >= 2) {
      return {
        latitude: data[1],  // lat is second in the response
        longitude: data[0]  // lon is first in the response
      };
    }
    
    throw new Error("Invalid response format from MapTiler API");
  } catch (error) {
    console.error("Error using MapTiler API:", error);
    return null;
  }
};

// Transform coordinates from one CRS to another
export const transformCoordinates = async (params: TransformationParams): Promise<TransformedCoordinates> => {
  const { fromCRS, toCRS, coordinates } = params;
  const [x, y] = coordinates;
  
  console.log(`Transforming coordinates from ${fromCRS} to ${toCRS}:`, coordinates);
  
  // If target is WGS84 and source is an Indiana county system
  if (toCRS === "EPSG:4326") {
    // First try MapTiler API for accurate transformation
    try {
      const maptilerResult = await transformWithMapTiler(fromCRS, toCRS, coordinates);
      if (maptilerResult) {
        console.log(`MapTiler transformed coordinates: [${maptilerResult.latitude}, ${maptilerResult.longitude}]`);
        
        return {
          latitude: maptilerResult.latitude,
          longitude: maptilerResult.longitude,
          originalX: x,
          originalY: y,
          fromCRS,
          toCRS
        };
      }
    } catch (error) {
      console.error("MapTiler transformation failed, falling back to local transformation:", error);
    }
    
    // Fall back to local transformation if MapTiler fails
    const transformParams = getTransformationParams(fromCRS);
    
    if (transformParams) {
      // Check if coordinates look like projected coordinates
      if (isProjectedCoordinates(x, y)) {
        console.log("Coordinates appear to be projected, transforming...");
        const [lat, lon] = inverseTransverseMercator(x, y, transformParams);
        
        console.log(`Transformed coordinates: [${lat}, ${lon}]`);
        
        return {
          latitude: lat,
          longitude: lon,
          originalX: x,
          originalY: y,
          fromCRS,
          toCRS
        };
      } else {
        console.log("Coordinates appear to already be geographic, using as-is");
        return {
          latitude: x,
          longitude: y,
          originalX: x,
          originalY: y,
          fromCRS,
          toCRS
        };
      }
    }
  }
  
  // If no transformation is needed or available, return coordinates as-is
  console.log("No transformation available or needed, using coordinates as-is");
  
  // If coordinates are already in a reasonable geographic range, use them directly
  if (!isProjectedCoordinates(x, y)) {
    return {
      latitude: x,
      longitude: y,
      originalX: x,
      originalY: y,
      fromCRS,
      toCRS
    };
  }
  
  // For projected coordinates without a known transformation, use the center of Indiana as a fallback
  console.log("Using fallback coordinates for Indiana");
  return {
    latitude: 39.7684,
    longitude: -86.1581,
    originalX: x,
    originalY: y,
    fromCRS,
    toCRS
  };
};

// Transform project location to WGS84 for map display
export const transformProjectLocation = async (project: {
  location?: { latitude: number; longitude: number };
  crs?: { horizontal?: string };
}): Promise<{ latitude: number; longitude: number } | null> => {
  if (!project.location) {
    return null;
  }
  
  const { latitude, longitude } = project.location;
  const horizontalCRS = project.crs?.horizontal || "EPSG:4326";
  
  console.log(`Transforming project location from ${horizontalCRS}:`, { latitude, longitude });
  
  // If already in WGS84, return as-is
  if (horizontalCRS === "EPSG:4326") {
    return { latitude, longitude };
  }
  
  try {
    // Check if coordinates are already in a reasonable geographic range
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
        Math.abs(latitude) > 0.01 && Math.abs(longitude) > 0.01) {
      console.log(`Project coordinates already in geographic range: [${latitude}, ${longitude}]`);
      return { latitude, longitude };
    }
    
    // For projected coordinates (large numbers), try MapTiler API transformation
    if (Math.abs(latitude) > 1000 || Math.abs(longitude) > 1000) {
      console.log(`Detected projected coordinates, attempting transformation via MapTiler API`);
      
      try {
        // For projected coordinates, the order is typically easting (x), northing (y)
        // In our case, longitude is easting and latitude is northing
        const maptilerResult = await transformWithMapTiler(horizontalCRS, "EPSG:4326", [longitude, latitude]);
        if (maptilerResult) {
          console.log(`MapTiler transformed project coordinates from ${horizontalCRS} to EPSG:4326:`, {
            from: [longitude, latitude],
            to: [maptilerResult.longitude, maptilerResult.latitude]
          });
          
          // Validate the transformed coordinates are reasonable
          if (Math.abs(maptilerResult.latitude) <= 90 && Math.abs(maptilerResult.longitude) <= 180) {
            return maptilerResult;
          } else {
            console.warn("MapTiler returned invalid coordinates:", maptilerResult);
          }
        }
      } catch (error) {
        console.error("MapTiler transformation failed:", error);
      }
    }
    
    // If MapTiler API fails, use the center of the CRS bbox as a fallback
    const crsData = indianaData.find(item => `${item.id.authority}:${item.id.code}` === horizontalCRS);
    if (crsData && crsData.bbox) {
      const [minLon, minLat, maxLon, maxLat] = crsData.bbox;
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      
      console.log(`Using CRS bbox center as fallback for ${horizontalCRS}: [${centerLat}, ${centerLon}]`);
      return { 
        latitude: centerLat, 
        longitude: centerLon 
      };
    }
    
    // Last resort fallback to center of Indiana
    console.log("Using Indiana center as final fallback");
    return { 
      latitude: 39.7684, 
      longitude: -86.1581 
    };
  } catch (error) {
    console.error("Error transforming coordinates:", error);
    
    // Last resort fallback to center of Indiana
    return { 
      latitude: 39.7684, 
      longitude: -86.1581 
    };
  }
};

// Create a named export object to fix the linting error
const coordinateTransformService = {
  transformWithMapTiler,
  transformProjectLocation
};

export default coordinateTransformService;
