// Transform coordinates using MapTiler API

// Type definitions for coordinate transformation
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

const transformWithMapTiler = async (
  fromCRS: string,
  toCRS: string,
  coordinates: [number, number]
): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const sourceCRS = fromCRS.split(":")[1];
    const targetCRS = toCRS.split(":")[1] || "4326";
    const [x, y] = coordinates;
    const apiKey = process.env.MAPTILER_API_KEY || "3zy0Sl3tcfZaOQFhQD8J";
    const url = `https://api.maptiler.com/coordinates/transform/${x},${y}.json?s_srs=${sourceCRS}&t_srs=${targetCRS}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`MapTiler API error: ${response.statusText}`);

    const data = await response.json();
    if (data?.results?.[0]) {
      const result = data.results[0];
      if (typeof result.x === 'number' && typeof result.y === 'number') {
        return { longitude: result.x, latitude: result.y };
      }
    }

    if (Array.isArray(data) && data.length >= 2) {
      return { latitude: data[1], longitude: data[0] };
    }

    throw new Error("Invalid response format from MapTiler API");
  } catch (error) {
    console.error("Error using MapTiler API:", error);
    return null;
  }
};

export const transformCoordinates = async (params: TransformationParams): Promise<TransformedCoordinates> => {
  const { fromCRS, toCRS, coordinates } = params;
  const [x, y] = coordinates;

  const result = await transformWithMapTiler(fromCRS, toCRS, coordinates);
  return {
    latitude: result?.latitude ?? x,
    longitude: result?.longitude ?? y,
    originalX: x,
    originalY: y,
    fromCRS,
    toCRS
  };
};

export const transformProjectLocation = async (project: {
  location?: { latitude: number; longitude: number };
  crs?: { horizontal?: string };
}): Promise<{ latitude: number; longitude: number } | null> => {
  if (!project.location) return null;
  const { latitude, longitude } = project.location;
  const horizontalCRS = project.crs?.horizontal || "EPSG:4326";

  if (horizontalCRS === "EPSG:4326") {
    return { latitude, longitude };
  }

  const result = await transformWithMapTiler(horizontalCRS, "EPSG:4326", [longitude, latitude]);
  if (result && result.latitude >= -90 && result.latitude <= 90 && result.longitude >= -180 && result.longitude <= 180) {
    return result;
  }

  return { latitude, longitude };
};

export const pixelToMapCoordinates = (i: number, j: number, worldFile: {
  pixelSizeX: number;
  pixelSizeY: number;
  rotationX: number;
  rotationY: number;
  upperLeftX: number;
  upperLeftY: number;
}): [number, number] => {
  const x = worldFile.upperLeftX + i * worldFile.pixelSizeX + j * worldFile.rotationX;
  const y = worldFile.upperLeftY + i * worldFile.rotationY + j * worldFile.pixelSizeY;
  return [x, y];
};

const coordinateTransformService = {
  transformWithMapTiler,
  transformProjectLocation,
  pixelToMapCoordinates
};

export default coordinateTransformService;
