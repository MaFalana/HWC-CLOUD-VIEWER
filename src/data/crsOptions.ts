import { CRSOption } from "@/types/project";

// Common CRS combinations for surveying work
export const commonCRSCombinations = [
  {
    name: "GEOID18 + NAVD88 (ftUS) - Recommended",
    horizontal: "EPSG:2965", // NAD83 / Indiana East (ftUS) - adjust based on your typical area
    vertical: "EPSG:6360", // NAVD88 height (ftUS)
    geoid: "GEOID18",
    description: "Most current geoid model with NAVD88 in US Survey Feet"
  },
  {
    name: "NAD83(2011) + NAVD88 (ftUS)",
    horizontal: "EPSG:6461", // NAD83(2011) / Indiana West (ftUS)
    vertical: "EPSG:6360", // NAVD88 height (ftUS)
    geoid: "GEOID18",
    description: "Latest NAD83 realization with current geoid"
  }
];

export const horizontalCRSOptions: CRSOption[] = [
  // Most commonly used options first
  { code: "EPSG:2965", name: "NAD83 / Indiana East (ftUS)", type: "horizontal", recommended: true },
  { code: "EPSG:2966", name: "NAD83 / Indiana West (ftUS)", type: "horizontal", recommended: true },
  { code: "EPSG:6461", name: "NAD83(2011) / Indiana West (ftUS)", type: "horizontal", recommended: true },
  { code: "EPSG:2792", name: "NAD83(HARN) / Indiana East", type: "horizontal" },
  { code: "EPSG:2793", name: "NAD83(HARN) / Indiana West", type: "horizontal" },
  { code: "EPSG:2967", name: "NAD83(HARN) / Indiana East", type: "horizontal" },
  { code: "EPSG:4326", name: "WGS 84", type: "horizontal" },
  { code: "EPSG:3857", name: "WGS 84 / Pseudo-Mercator", type: "horizontal" },
  { code: "EPSG:4269", name: "NAD83", type: "horizontal" },
  { code: "EPSG:4152", name: "NAD83(HARN)", type: "horizontal" },
];

export const verticalCRSOptions: CRSOption[] = [
  // NAVD88 first as it's most commonly used
  { code: "EPSG:6360", name: "NAVD88 height (ftUS)", type: "vertical", recommended: true },
  { code: "EPSG:5702", name: "NGVD29 height (ftUS)", type: "vertical" },
  { code: "EPSG:8052", name: "MSL height (ftUS)", type: "vertical" },
  { code: "ESRI:105798", name: "EGM96_Geoid_(ftUS)", type: "vertical" },
  { code: "ESRI:115908", name: "Unknown_height_system_(US_survey_foot)", type: "vertical" },
];

export const geoidOptions: CRSOption[] = [
  // GEOID18 first as it's the most current
  { code: "GEOID18", name: "GEOID18 (Current)", type: "geoid", recommended: true },
  { code: "GEOID12B", name: "GEOID12B", type: "geoid" },
  { code: "GEOID12A", name: "GEOID12A", type: "geoid" },
  { code: "GEOID09", name: "GEOID09", type: "geoid" },
  { code: "GEOID99", name: "GEOID99", type: "geoid" },
  { code: "GGM10", name: "GGM10", type: "geoid" },
];

// Default CRS settings based on typical usage
export const defaultCRSSettings = {
  horizontal: "EPSG:2965", // NAD83 / Indiana East (ftUS)
  vertical: "EPSG:6360",   // NAVD88 height (ftUS)
  geoid: "GEOID18"         // Most current geoid model
};
