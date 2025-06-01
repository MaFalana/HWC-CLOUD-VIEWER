import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Eye, Edit, Trash2, Layers } from "lucide-react";
import { Project } from "@/types/project";
import { useRouter } from "next/router";

interface ProjectMapProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (jobNumber: string) => void;
}

export default function ProjectMap({ projects, onEdit, onDelete }: ProjectMapProps) {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [mapType, setMapType] = useState<"street" | "satellite">("street");

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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const projectsWithLocation = projects.filter(p => p.location && p.location.latitude && p.location.longitude);

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

      {/* Placeholder Map Background */}
      <div className="w-full h-full bg-gradient-to-br from-green-100 to-blue-100 relative">
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%" className="text-gray-400">
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        
        {/* Project Markers */}
        {projectsWithLocation.map((project, index) => (
          <div
            key={project.jobNumber}
            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${20 + (index % 5) * 15}%`,
              top: `${30 + Math.floor(index / 5) * 20}%`,
            }}
            onClick={() => setSelectedProject(project)}
          >
            <div className={`w-8 h-8 rounded-full ${getStatusColor(project.status)} flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}>
              <MapPin className="h-4 w-4 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Project List Sidebar */}
      <div className="absolute left-4 top-4 bottom-4 w-80 bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b bg-hwc-dark text-white">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Projects ({projectsWithLocation.length})
          </h3>
        </div>
        <div className="overflow-y-auto h-full">
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
                Created: {formatDate(selectedProject.createdAt)}
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
    </div>
  );
}
