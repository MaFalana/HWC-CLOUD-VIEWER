import { arcgisService } from "@/services/arcgisService";

// CRS to approximate location mapping for Indiana counties
const CRS_TO_LOCATION_MAP: Record<string, { latitude: number; longitude: number; address: string }> = {
  // State Plane Systems (approximate center of Indiana)
  "EPSG:2965": { latitude: 39.7684, longitude: -85.8419, address: "Indiana East Zone" },
  "EPSG:2966": { latitude: 39.7684, longitude: -87.1581, address: "Indiana West Zone" },
  "EPSG:6459": { latitude: 39.7684, longitude: -85.8419, address: "Indiana East Zone (NAD83 2011)" },
  "EPSG:6461": { latitude: 39.7684, longitude: -87.1581, address: "Indiana West Zone (NAD83 2011)" },
  
  // County Systems - approximate county centers
  "EPSG:3532": { latitude: 40.7447, longitude: -84.9822, address: "Adams County, IN" },
  "EPSG:3533": { latitude: 41.0793, longitude: -85.1394, address: "Allen County, IN" },
  "EPSG:3534": { latitude: 39.2014, longitude: -85.9136, address: "Bartholomew County, IN" },
  "EPSG:3535": { latitude: 40.7006, longitude: -87.3378, address: "Benton County, IN" },
  "EPSG:3536": { latitude: 40.4842, longitude: -85.0130, address: "Blackford County, IN" },
  "EPSG:3537": { latitude: 40.0448, longitude: -86.4822, address: "Boone County, IN" },
  "EPSG:3538": { latitude: 39.1653, longitude: -86.2456, address: "Brown County, IN" },
  "EPSG:3539": { latitude: 40.5681, longitude: -86.9139, address: "Carroll County, IN" },
  "EPSG:3540": { latitude: 40.7553, longitude: -86.3847, address: "Cass County, IN" },
  "EPSG:3541": { latitude: 38.3570, longitude: -85.7303, address: "Clark County, IN" },
  "EPSG:3542": { latitude: 39.4403, longitude: -87.1289, address: "Clay County, IN" },
  "EPSG:3543": { latitude: 40.1531, longitude: -86.4719, address: "Clinton County, IN" },
  "EPSG:3544": { latitude: 38.2570, longitude: -86.5264, address: "Crawford County, IN" },
  "EPSG:3545": { latitude: 38.6781, longitude: -87.1289, address: "Daviess County, IN" },
  "EPSG:3546": { latitude: 39.3020, longitude: -84.9269, address: "Dearborn County, IN" },
  "EPSG:3547": { latitude: 39.3631, longitude: -85.4008, address: "Decatur County, IN" },
  "EPSG:3548": { latitude: 41.3114, longitude: -85.0269, address: "DeKalb County, IN" },
  "EPSG:3549": { latitude: 40.1714, longitude: -85.3886, address: "Delaware County, IN" },
  "EPSG:3550": { latitude: 38.4292, longitude: -86.9139, address: "Dubois County, IN" },
  "EPSG:3551": { latitude: 41.6819, longitude: -85.9769, address: "Elkhart County, IN" },
  "EPSG:3552": { latitude: 39.5581, longitude: -85.1269, address: "Fayette County, IN" },
  "EPSG:3553": { latitude: 38.2881, longitude: -85.9269, address: "Floyd County, IN" },
  "EPSG:3554": { latitude: 40.0331, longitude: -87.2789, address: "Fountain County, IN" },
  "EPSG:3555": { latitude: 39.4831, longitude: -85.0969, address: "Franklin County, IN" },
  "EPSG:3556": { latitude: 41.1131, longitude: -86.0269, address: "Fulton County, IN" },
  "EPSG:3557": { latitude: 38.1881, longitude: -87.5558, address: "Gibson County, IN" },
  "EPSG:3558": { latitude: 40.4531, longitude: -85.6469, address: "Grant County, IN" },
  "EPSG:3559": { latitude: 39.0331, longitude: -87.1289, address: "Greene County, IN" },
  "EPSG:3560": { latitude: 40.0448, longitude: -86.0469, address: "Hamilton County, IN" },
  "EPSG:3561": { latitude: 39.8331, longitude: -85.8469, address: "Hancock County, IN" },
  "EPSG:3562": { latitude: 38.1131, longitude: -86.1069, address: "Harrison County, IN" },
  "EPSG:3563": { latitude: 39.6831, longitude: -86.7469, address: "Hendricks County, IN" },
  "EPSG:3564": { latitude: 39.9331, longitude: -85.3469, address: "Henry County, IN" },
  "EPSG:3565": { latitude: 40.4531, longitude: -86.2969, address: "Howard County, IN" },
  "EPSG:3566": { latitude: 40.8331, longitude: -85.4969, address: "Huntington County, IN" },
  "EPSG:3567": { latitude: 38.9831, longitude: -85.8469, address: "Jackson County, IN" },
  "EPSG:3568": { latitude: 40.9331, longitude: -87.1289, address: "Jasper County, IN" },
  "EPSG:3569": { latitude: 40.3331, longitude: -84.9469, address: "Jay County, IN" },
  "EPSG:3570": { latitude: 38.7331, longitude: -85.3969, address: "Jefferson County, IN" },
  "EPSG:3571": { latitude: 39.0831, longitude: -85.6469, address: "Jennings County, IN" },
  "EPSG:3572": { latitude: 39.5331, longitude: -86.0969, address: "Johnson County, IN" },
  "EPSG:3573": { latitude: 38.7831, longitude: -87.5289, address: "Knox County, IN" },
  "EPSG:3574": { latitude: 41.2331, longitude: -85.8469, address: "Kosciusko County, IN" },
  "EPSG:3575": { latitude: 41.5831, longitude: -85.4169, address: "LaGrange County, IN" },
  "EPSG:3576": { latitude: 41.4831, longitude: -87.4289, address: "Lake County, IN" },
  "EPSG:3577": { latitude: 41.6331, longitude: -86.7289, address: "LaPorte County, IN" },
  "EPSG:3578": { latitude: 38.8331, longitude: -86.4969, address: "Lawrence County, IN" },
  "EPSG:3579": { latitude: 40.1831, longitude: -85.6969, address: "Madison County, IN" },
  "EPSG:3580": { latitude: 39.7684, longitude: -86.1581, address: "Marion County, IN" },
  "EPSG:3581": { latitude: 41.3331, longitude: -86.2969, address: "Marshall County, IN" },
  "EPSG:3582": { latitude: 38.6831, longitude: -86.9469, address: "Martin County, IN" },
  "EPSG:3583": { latitude: 40.7831, longitude: -86.0969, address: "Miami County, IN" },
  "EPSG:3584": { latitude: 39.1653, longitude: -86.5264, address: "Monroe County, IN" },
  "EPSG:3585": { latitude: 40.0831, longitude: -87.0289, address: "Montgomery County, IN" },
  "EPSG:3586": { latitude: 39.4831, longitude: -86.4469, address: "Morgan County, IN" },
  "EPSG:3587": { latitude: 40.9831, longitude: -87.2789, address: "Newton County, IN" },
  "EPSG:3588": { latitude: 41.4331, longitude: -85.7969, address: "Noble County, IN" },
  "EPSG:3589": { latitude: 39.2831, longitude: -84.9469, address: "Ohio County, IN" },
  "EPSG:3590": { latitude: 38.5831, longitude: -86.4969, address: "Orange County, IN" },
  "EPSG:3591": { latitude: 39.2831, longitude: -86.7969, address: "Owen County, IN" },
  "EPSG:3592": { latitude: 39.7831, longitude: -87.2289, address: "Parke County, IN" },
  "EPSG:3593": { latitude: 38.0831, longitude: -86.6469, address: "Perry County, IN" },
  "EPSG:3594": { latitude: 38.4831, longitude: -87.2289, address: "Pike County, IN" },
  "EPSG:3595": { latitude: 41.4831, longitude: -87.0789, address: "Porter County, IN" },
  "EPSG:3596": { latitude: 38.0831, longitude: -87.9289, address: "Posey County, IN" },
  "EPSG:3597": { latitude: 41.0331, longitude: -86.5969, address: "Pulaski County, IN" },
  "EPSG:3598": { latitude: 39.6331, longitude: -86.8469, address: "Putnam County, IN" },
  "EPSG:3599": { latitude: 40.0831, longitude: -85.0469, address: "Randolph County, IN" },
  "EPSG:3600": { latitude: 39.0831, longitude: -85.2469, address: "Ripley County, IN" },
  "EPSG:3601": { latitude: 39.6831, longitude: -85.4469, address: "Rush County, IN" },
  "EPSG:3602": { latitude: 38.6831, longitude: -85.7469, address: "Scott County, IN" },
  "EPSG:3603": { latitude: 39.5331, longitude: -85.7969, address: "Shelby County, IN" },
  "EPSG:3604": { latitude: 38.1831, longitude: -87.0289, address: "Spencer County, IN" },
  "EPSG:3605": { latitude: 41.2831, longitude: -86.9969, address: "Starke County, IN" },
  "EPSG:3606": { latitude: 41.6831, longitude: -85.0469, address: "Steuben County, IN" },
  "EPSG:3607": { latitude: 41.7018, longitude: -86.2390, address: "St Joseph County, IN" },
  "EPSG:3608": { latitude: 39.0831, longitude: -87.5789, address: "Sullivan County, IN" },
  "EPSG:3609": { latitude: 38.9831, longitude: -84.8469, address: "Switzerland County, IN" },
  "EPSG:3610": { latitude: 40.4831, longitude: -86.8969, address: "Tippecanoe County, IN" },
  "EPSG:3611": { latitude: 40.2831, longitude: -86.0469, address: "Tipton County, IN" },
  "EPSG:3612": { latitude: 39.6831, longitude: -84.9969, address: "Union County, IN" },
  "EPSG:3613": { latitude: 37.9747, longitude: -87.5558, address: "Vanderburgh County, IN" },
  "EPSG:3614": { latitude: 39.9831, longitude: -87.4289, address: "Vermillion County, IN" },
  "EPSG:3615": { latitude: 39.4831, longitude: -87.4289, address: "Vigo County, IN" },
  "EPSG:3616": { latitude: 40.7831, longitude: -85.8469, address: "Wabash County, IN" },
  "EPSG:3617": { latitude: 40.3831, longitude: -87.3289, address: "Warren County, IN" },
  "EPSG:3618": { latitude: 38.1831, longitude: -87.3289, address: "Warrick County, IN" },
  "EPSG:3619": { latitude: 38.6831, longitude: -86.1469, address: "Washington County, IN" },
  "EPSG:3620": { latitude: 39.9831, longitude: -84.9969, address: "Wayne County, IN" },
  "EPSG:3621": { latitude: 40.7331, longitude: -85.2469, address: "Wells County, IN" },
  "EPSG:3622": { latitude: 40.9831, longitude: -86.9469, address: "White County, IN" },
  "EPSG:3623": { latitude: 41.1331, longitude: -85.4969, address: "Whitley County, IN" },
  
  // Special combined systems
  "EPSG:7328": { latitude: 39.6507, longitude: -86.1270, address: "Johnson-Marion County, IN" },
  
  // UTM and Geographic systems (center of Indiana)
  "EPSG:26916": { latitude: 39.7684, longitude: -86.1581, address: "Indiana (UTM 16N)" },
  "EPSG:32616": { latitude: 39.7684, longitude: -86.1581, address: "Indiana (UTM 16N WGS84)" },
  "EPSG:4269": { latitude: 39.7684, longitude: -86.1581, address: "Indiana (NAD83)" },
  "EPSG:4326": { latitude: 39.7684, longitude: -86.1581, address: "Indiana (WGS84)" }
};

export const locationService = {
  /**
   * Get location from CRS code using predefined mapping
   */
  getLocationFromCRS(crsCode: string): { latitude: number; longitude: number; address: string } | null {
    const location = CRS_TO_LOCATION_MAP[crsCode];
    if (location) {
      return { ...location };
    }
    
    // Default to center of Indiana if CRS not found
    if (crsCode.includes('EPSG:') || crsCode.includes('Indiana') || crsCode.includes('InGCS')) {
      return {
        latitude: 39.7684,
        longitude: -86.1581,
        address: "Indiana"
      };
    }
    
    return null;
  },

  /**
   * Derive location from project CRS data
   */
  deriveLocationFromProject(project: { crs?: { horizontal?: string; vertical?: string; geoidModel?: string } }): { latitude: number; longitude: number; address: string } | null {
    if (!project.crs?.horizontal) {
      return null;
    }

    // Try to get location from horizontal CRS
    const location = this.getLocationFromCRS(project.crs.horizontal);
    if (location) {
      return location;
    }

    // Fallback to center of Indiana
    return {
      latitude: 39.7684,
      longitude: -86.1581,
      address: "Indiana"
    };
  },

  /**
   * Validate and normalize coordinates
   */
  validateCoordinates(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      isFinite(latitude) &&
      isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      latitude !== 0 &&
      longitude !== 0
    );
  }
};
