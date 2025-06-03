// Coordinate transformation service for converting between different CRS
// Primarily for converting InGCS county coordinates to WGS84 for web mapping

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
  // WGS84 first eccentricity squared - used in more precise calculations
  // const e2 = 0.00669437999014;
  
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

// Check if coordinates appear to be in a projected coordinate system
const isProjectedCoordinates = (lat: number, lon: number): boolean => {
  // If coordinates are very large (> 1000), they're likely projected coordinates
  // Geographic coordinates should be within [-180, 180] for longitude and [-90, 90] for latitude
  return Math.abs(lat) > 1000 || Math.abs(lon) > 1000;
};

// Transform coordinates from one CRS to another
export const transformCoordinates = async (params: TransformationParams): Promise<TransformedCoordinates> => {
  const { fromCRS, toCRS, coordinates } = params;
  const [x, y] = coordinates;
  
  console.log(`Transforming coordinates from ${fromCRS} to ${toCRS}:`, coordinates);
  
  // If target is WGS84 and source is an Indiana county system
  if (toCRS === "EPSG:4326" && INDIANA_TRANSFORMATIONS[fromCRS]) {
    const transformParams = INDIANA_TRANSFORMATIONS[fromCRS];
    
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
  
  // If no transformation is needed or available, return coordinates as-is
  console.log("No transformation available, using coordinates as-is");
  return {
    latitude: x,
    longitude: y,
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
  
  // If already in WGS84, return as-is
  if (horizontalCRS === "EPSG:4326") {
    return { latitude, longitude };
  }
  
  try {
    const transformed = await transformCoordinates({
      fromCRS: horizontalCRS,
      toCRS: "EPSG:4326",
      coordinates: [latitude, longitude]
    });
    
    return {
      latitude: transformed.latitude,
      longitude: transformed.longitude
    };
  } catch (error) {
    console.error("Error transforming coordinates:", error);
    return { latitude, longitude }; // Fallback to original coordinates
  }
};

// Create a named export object to fix the linting error
const coordinateTransformService = {
  transformCoordinates,
  transformProjectLocation
};

export default coordinateTransformService;
