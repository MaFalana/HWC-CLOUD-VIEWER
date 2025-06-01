
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Edit, Trash2, Layers } from "lucide-react";
import { Project } from "@/types/project";
import { useRouter } from "next/router";

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

  const projectsWithLocation = projects.filter(p => p.location && p.location.latitude && p.location.longitude);

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

      // Create map
      const map = window.L.map(mapContainerRef.current).setView([39.7684, -86.1581], 10);
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

      // Add markers for projects
      const bounds = window.L.latLngBounds([]);
      
      projectsWithLocation.forEach(project => {
        if (project.location && project.location.latitude && project.location.longitude) {
          const markerIcon = window.L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="marker-pin ${getStatusColor(project.status).replace('bg-', '')}"></div>`,
            iconSize: [30, 42],
            iconAnchor: [15, 42]
          });

          const marker = window.L.marker(
            [project.location.latitude, project.location.longitude],
            { icon: markerIcon }
          );

          marker.on('click', () => {
            setSelectedProject(project);
          });

          markersRef.current.push(marker);
          bounds.extend([project.location.latitude, project.location.longitude]);
        }
      });

      // Fit map to bounds if there are markers
      if (markersRef.current.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [projects, mapType, projectsWithLocation]);

  return (
    <div className="relative h-[calc(100vh-200px)] bg-gray-100 rounded-lg overflow-hidden">
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant={mapType === "street" ? "default" : "outline"}
          size="sm"
          onClick={() => setMapType("street")}
          className="bg-white text-black hover:bg-gray-100"
        >
          Street
        </Button>
        <Button
          variant={mapType === "satellite" ? "default" : "outline"}
          size="sm"
          onClick={() => setMapType("satellite")}
          className="bg-white text-black hover:bg-gray-100"
        >
          Satellite
        </Button>
      </div>

      {/* OpenStreetMap Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full"
      />

      {/* Project List Sidebar */}
      <div className="absolute left-4 top-4 bottom-4 w-80 bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b bg-hwc-dark text-white">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Projects ({projectsWithLocation.length})
          </h3>
        </div>
        <div className="overflow-y-auto h-[calc(100%-56px)]">
          {projectsWithLocation.map((project) => (
            <div
              key={project.jobNumber}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                selectedProject?.jobNumber === project.jobNumber ? "bg-blue-50 border-blue-200" : ""
              }`}
              onClick={() => setSelectedProject(project)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm truncate">{project.projectName}</h4>
                  <p className="text-xs text-gray-500">#{project.jobNumber}</p>
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
                  className="h-6 w-6 p-0"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Details Popup */}
      {selectedProject && (
        <div className="absolute bottom-4 right-4 z-20">
          <Card className="w-80 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{selectedProject.projectName}</h3>
                  <p className="text-sm text-gray-500">Job #{selectedProject.jobNumber}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProject(null)}
                  className="h-6 w-6 p-0"
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
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onDelete(selectedProject.jobNumber)}
                  size="sm"
                  className="text-red-600 hover:text-red-700"
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
      `}</style>
    </div>
  );
}
