import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, Calendar, MapPin } from "lucide-react";
import { Project } from "@/types/project";
import { useRouter } from "next/router";

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (jobNumber: string) => void;
}

export default function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const router = useRouter();

  const handleOpen = () => {
    router.push(`/view/${project.jobNumber}`);
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

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200 card-hover">
      <div 
        className="relative h-40 bg-gray-200 overflow-hidden"
      >
        <div className="flex items-center justify-center h-full bg-hwc-light/30">
          <div className="text-hwc-dark/50 text-lg font-semibold">No Image</div>
        </div>
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge className={`${getStatusColor(project.status)} text-white`}>
            {project.status}
          </Badge>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
          <div className="p-3 w-full flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project);
              }}
              className="bg-white/80 hover:bg-white text-black"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project.jobNumber);
              }}
              className="bg-white/80 hover:bg-white text-red-600"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="mb-2">
          <h3 className="font-semibold text-lg line-clamp-1">{project.projectName}</h3>
          <p className="text-sm text-gray-500 font-mono">{project.jobNumber}</p>
        </div>

        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(project.acquistionDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          {project.clientName && (
            <div className="flex items-center gap-1">
              <span>{project.clientName}</span>
            </div>
          )}
          {project.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {project.location.address || `${project.location.latitude}, ${project.location.longitude}`}
            </div>
          )}
        </div>

        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {project.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs bg-hwc-light text-hwc-dark">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-hwc-light text-hwc-dark">
                +{project.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button onClick={handleOpen} className="w-full bg-hwc-red hover:bg-hwc-red/90 text-white font-medium">
          <Eye className="h-4 w-4 mr-2" />
          Open
        </Button>
      </CardFooter>
    </Card>
  );
}
