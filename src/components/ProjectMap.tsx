import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Edit, Trash2, Layers } from "lucide-react";
import { Project } from "@/types/project";
import { useRouter } from "next/router";
import { transformProjectLocation } from "@/services/coordinateTransformService";
import indianaData from "@/data/Indiana.json";

interface ProjectMapProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (jobNumber: string) => void;
}

// Leaflet types
interface LeafletMap {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  remove: () => void;
  fitBounds: (bounds: LeafletLatLngBounds, options?: { padding: [number, number] }) => void;
}

interface LeafletMarker {
  on: (event: string, callback: () => void) => void;
  remove: () => void;
  addTo: (map: LeafletMap) => LeafletMarker;
}

interface LeafletLatLngBounds {
  extend: (latlng: [number, number]) => void;
}

interface LeafletTileLayer {
  addTo: (map: LeafletMap) => LeafletTileLayer;
}

interface LeafletDivIcon {
  className: string;
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
}

interface LeafletStatic {
  map: (element: HTMLElement) => LeafletMap;
  tileLayer: (url: string, options: { attribution: string }) => LeafletTileLayer;
  latLngBounds: (bounds: never[]) => LeafletLatLngBounds;
  divIcon: (options: LeafletDivIcon) => LeafletDivIcon;
  marker: (latlng: [number, number], options: { icon: LeafletDivIcon }) => LeafletMarker;
}

declare global {
  interface Window {
    L: LeafletStatic;
  }
}

export default function ProjectMap({ projects, onEdit, onDelete }: ProjectMapProps) {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [mapType, setMapType] = useState<"street" | "satellite">("street");
  const [transformedProjects, setTransformedProjects] = useState<(Project & { transformedLocation?: { latitude: number; longitude: number } })[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  const handleOpen = (jobNumber: string) => {
    router.push(`/view/${jobNumber}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "processing":
        return "bg-yellow-500";
      case "archived":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  // Transform project coordinates when projects change
  useEffect(() => {
    const transformProjects = async () => {
      console.log("Transforming project coordinates...");
      const transformed = await Promise.all(
        projects.map(async (project) => {
          // If the project has no location or CRS, use the center of Indiana as a fallback
          if (!project.location || !project.crs?.horizontal) {
            console.log(`Project ${project.jobNumber} has no location or CRS, using fallback`);
            return {
              ...project,
              transformedLocation: {
                latitude: project.location?.latitude,// || 39.7684, // Default to Indianapolis latitude
                longitude: project.location?.longitude// || -86.1581 // Default to Indianapolis longitude
              }
            };
          }
          
          // If the coordinates are already in a reasonable geographic range, use them directly
          if (project.location.latitude > -90 && project.location.latitude < 90 &&
              project.location.longitude > -180 && project.location.longitude < 180 &&
              Math.abs(project.location.latitude) > 0.01 && Math.abs(project.location.longitude) > 0.01) {
            console.log(`Project ${project.jobNumber} already has geographic coordinates`);
            return {
              ...project,
              transformedLocation: project.location
            };
          }
          
          // Try to transform the coordinates using MapTiler API
          try {
            const transformedLocation = await transformProjectLocation(project);
            
            if (transformedLocation) {
              console.log(`Successfully transformed coordinates for ${project.jobNumber}:`, {
                from: project.location,
                to: transformedLocation
              });
              
              return {
                ...project,
                transformedLocation
              };
            }
          } catch (error) {
            console.error(`Error transforming coordinates for ${project.jobNumber}:`, error);
          }
          
          // If transformation failed, try to use the center of the CRS bbox as a fallback
          
          // Default to center of Indiana if all else fails
          
        })
      );
      setTransformedProjects(transformed);
    };

    transformProjects();
  }, [projects]);

  const projectsWithLocation = transformedProjects.filter(p => {
    const location = p.transformedLocation || p.location;
    // Check if project has valid transformed location coordinates
    return location && 
           location.latitude && 
           location.longitude && 
           location.latitude !== 0 && 
           location.longitude !== 0 &&
           Math.abs(location.latitude) <= 90 &&
           Math.abs(location.longitude) <= 180;
  });

  console.log('Projects with valid location:', projectsWithLocation.length, 'out of', projects.length);
  console.log('Transformed projects:', transformedProjects.map(p => ({
    jobNumber: p.jobNumber,
    originalLocation: p.location,
    transformedLocation: p.transformedLocation,
    crs: p.crs?.horizontal
  })));

  // Initialize OpenStreetMap
  useEffect(() => {
    // Load OpenStreetMap CSS
    const loadCSS = () => {
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "";
        document.head.appendChild(link);
      }
    };

    // Load OpenStreetMap JS
    const loadScript = (): Promise<void> => {
      return new Promise((resolve) => {
        if (window.L) {
          resolve();
          return;
        }

        if (!document.querySelector('script[src*="leaflet.js"]')) {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
          script.crossOrigin = "";
          script.onload = () => resolve();
          document.body.appendChild(script);
        } else {
          resolve();
        }
      });
    };

    const initMap = async () => {
      loadCSS();
      await loadScript();

      if (!mapContainerRef.current || !window.L) return;

      // Clear existing map
      if (mapRef.current) {
        mapRef.current.remove();
      }

      // Create map centered on Indiana
      const map = window.L.map(mapContainerRef.current).setView([39.7684, -86.1581], 7);
      mapRef.current = map;

      // Add tile layer based on selected map type
      if (mapType === "satellite") {
        window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(map);
      } else {
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
      }

      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      // Add markers for projects using transformed coordinates
      const bounds = window.L.latLngBounds([]);
      let hasValidMarkers = false;
      
      projectsWithLocation.forEach(project => {
        const location =  project.location;
        if (location && location.latitude && location.longitude) {
          // Validate coordinates are within reasonable bounds
          
            const markerIcon = window.L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="marker-pin ${getStatusColor(project.status).replace('bg-', '')}"></div>`,
              iconSize: [30, 42],
              iconAnchor: [15, 42]
            });

            const marker = window.L.marker(
              [location.latitude, location.longitude],
              { icon: markerIcon }
            );

            marker.on('click', () => {
              setSelectedProject(project);
            });

            // Add marker to map
            marker.addTo(map);
            markersRef.current.push(marker);
            bounds.extend([location.latitude, location.longitude]);
            hasValidMarkers = true;
            
            console.log(`Added marker for ${project.jobNumber} at [${location.latitude}, ${location.longitude}]`);
          
        }
      });

      // Fit map to bounds if there are markers
      if (hasValidMarkers) {
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        // Default view of Indiana if no valid markers
        map.setView([39.7684, -86.1581], 7);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [transformedProjects, mapType, projectsWithLocation]);

  return (
    <div className="relative h-[calc(100vh-200px)] bg-gray-100 rounded-lg overflow-hidden">
      {/* OpenStreetMap Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full"
        style={{ zIndex: 1 }}
      />

      {/* Project List Sidebar - Fixed z-index and positioning */}
      <div className="absolute left-4 top-4 bottom-20 w-80 bg-white rounded-lg shadow-xl overflow-hidden z-[1002] border border-gray-200">
        <div className="p-4 border-b bg-hwc-dark text-white">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Projects ({projectsWithLocation.length})
          </h3>
        </div>
        <div className="overflow-y-auto h-[calc(100%-56px)] bg-white">
          {projectsWithLocation.map((project) => (
            <div
              key={project.jobNumber}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedProject?.jobNumber === project.jobNumber ? "bg-blue-50 border-blue-200" : ""
              }`}
              onClick={() => setSelectedProject(project)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm truncate">{project.projectName}</h4>
                  <p className="text-xs text-gray-500">{project.jobNumber}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`${getStatusColor(project.status)} text-white text-xs`}>
                      {project.status}
                    </Badge>
                    {project.projectType && (
                      <Badge variant="outline" className="text-xs">
                        {project.projectType}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpen(project.jobNumber);
                  }}
                  className="h-6 w-6 p-0 hover:bg-gray-200"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map Controls - Moved to bottom left as requested */}
      <div className="absolute bottom-4 left-4 z-[1003] flex gap-2">
        <Button
          variant={mapType === "street" ? "default" : "outline"}
          size="sm"
          onClick={() => setMapType("street")}
          className="bg-white text-black hover:bg-gray-100 shadow-lg border border-gray-300"
        >
          Street
        </Button>
        <Button
          variant={mapType === "satellite" ? "default" : "outline"}
          size="sm"
          onClick={() => setMapType("satellite")}
          className="bg-white text-black hover:bg-gray-100 shadow-lg border border-gray-300"
        >
          Satellite
        </Button>
      </div>

      {/* Project Details Popup - Moved to avoid conflict with bottom left controls */}
      {selectedProject && (
        <div className="absolute bottom-16 left-4 z-[1004]">
          <Card className="w-80 shadow-xl bg-white border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{selectedProject.projectName}</h3>
                  <p className="text-sm text-gray-500">{selectedProject.jobNumber}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProject(null)}
                  className="h-6 w-6 p-0 hover:bg-gray-200"
                >
                  ×
                </Button>
              </div>
              
              {selectedProject.description && (
                <p className="text-sm text-gray-600 mb-3">{selectedProject.description}</p>
              )}
              
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`${getStatusColor(selectedProject.status)} text-white`}>
                  {selectedProject.status}
                </Badge>
                {selectedProject.projectType && (
                  <Badge variant="outline">
                    {selectedProject.projectType}
                  </Badge>
                )}
              </div>
              
              <div className="text-xs text-gray-500 mb-3">
                Acquired: {new Date(selectedProject.acquistionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC", // Ensure UTC display
                })}
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => handleOpen(selectedProject.jobNumber)}
                  className="flex-1 bg-hwc-red hover:bg-hwc-red/90"
                  size="sm"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Open
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onEdit(selectedProject)}
                  size="sm"
                  className="hover:bg-gray-100"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onDelete(selectedProject.jobNumber)}
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Custom Marker Styles */}
      <style jsx global>{`
        .marker-pin {
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          background: #c30b82;
          position: absolute;
          transform: rotate(-45deg);
          left: 50%;
          top: 50%;
          margin: -15px 0 0 -15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .marker-pin::after {
          content: '';
          width: 24px;
          height: 24px;
          margin: 3px 0 0 3px;
          background: #fff;
          position: absolute;
          border-radius: 50%;
        }

        .green-500 {
          background: #10b981;
        }

        .blue-500 {
          background: #3b82f6;
        }

        .yellow-500 {
          background: #eab308;
        }

        .gray-500 {
          background: #6b7280;
        }

        /* Ensure Leaflet controls don't interfere */
        .leaflet-control-container {
          z-index: 999 !important;
        }
        
        .leaflet-control {
          z-index: 999 !important;
        }

        /* Move Leaflet zoom controls to top right corner as requested */
        .leaflet-control-zoom {
          margin-left: auto !important;
          margin-right: 10px !important;
          margin-top: 10px !important;
          position: absolute !important;
          top: 0 !important;
          right: 0 !important;
          left: auto !important;
          z-index: 1000 !important;
        }

        /* Ensure zoom controls are positioned correctly */
        .leaflet-top.leaflet-right {
          top: 10px !important;
          right: 10px !important;
          z-index: 1000 !important;
        }

        /* Force visibility of our custom controls */
        .leaflet-container {
          z-index: 1 !important;
        }
        
        /* Ensure project list sidebar is always visible */
        .leaflet-control-container .leaflet-top.leaflet-left {
          z-index: 998 !important;
        }
        
        /* Make sure zoom controls don't interfere with sidebar */
        .leaflet-control-zoom {
          right: 10px !important;
          left: auto !important;
          top: 10px !important;
          z-index: 1000 !important;
        }
      `}</style>
    </div>
  );
}
