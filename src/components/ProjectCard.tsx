import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Eye, Edit, Trash2, MapPin, Calendar } from "lucide-react";
import { Project } from "@/types/project";
import Image from "next/image";
import { useRouter } from "next/router";

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (jobNumber: string) => void;
}

export default function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200 card-hover">
      <div className="relative aspect-video bg-gray-100 overflow-hidden rounded-t-lg">
        {project.thumbnailUrl && !imageError ? (
          <Image
            src={project.thumbnailUrl}
            alt={project.projectName}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-hwc-light">
            <MapPin className="h-12 w-12 text-hwc-gray" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Badge className={`${getStatusColor(project.status)} text-white`}>
            {project.status}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg truncate font-heading text-hwc-dark">{project.projectName}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-hwc-light/50">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpen}>
                <Eye className="h-4 w-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(project)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(project.jobNumber)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-sm text-hwc-gray mb-2 font-mono">Job #{project.jobNumber}</p>
        
        {project.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2 font-body">{project.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-hwc-gray font-body">
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
              <span>Client: {project.clientName}</span>
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
