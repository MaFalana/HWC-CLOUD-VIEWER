import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MapPin, Calendar, ExternalLink } from "lucide-react";
import { Project } from "@/types/project";
import { formatDate } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (jobNumber: string) => void;
}

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Try to load the thumbnail image
  useState(() => {
    const checkThumbnail = async () => {
      try {
        // Try to fetch the TIF/TIFF thumbnail
        const tifResponse = await fetch(`http://localhost:4400/pointclouds/${project.jobNumber}/${project.jobNumber}.tif`, { method: 'HEAD' });
        if (tifResponse.ok) {
          setThumbnailUrl(`http://localhost:4400/pointclouds/${project.jobNumber}/${project.jobNumber}.tif`);
          return;
        }
        
        // Try TIFF extension if TIF doesn't exist
        const tiffResponse = await fetch(`http://localhost:4400/pointclouds/${project.jobNumber}/${project.jobNumber}.tiff`, { method: 'HEAD' });
        if (tiffResponse.ok) {
          setThumbnailUrl(`http://localhost:4400/pointclouds/${project.jobNumber}/${project.jobNumber}.tiff`);
          return;
        }
        
        setThumbnailError(true);
      } catch (error) {
        console.log("Error checking thumbnail:", error);
        setThumbnailError(true);
      }
    };
    
    checkThumbnail();
  }, [project.jobNumber]);

  // Status badge color
  const getStatusColor = (status: Project["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "archived":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400";
      case "processing":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400";
    }
  };

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-md dark:hover:shadow-hwc-red/5 group">
      <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-800">
        {thumbnailUrl && !thumbnailError ? (
          <img 
            src={thumbnailUrl} 
            alt={project.projectName} 
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-hwc-dark to-hwc-dark/80">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2 opacity-20">
                <Image
                  src="/HWC-angle-logo-16px.png"
                  alt="HWC Logo"
                  width={64}
                  height={64}
                  className="w-full h-full"
                />
              </div>
              <p className="text-sm text-hwc-light/50">{project.projectType || "Project"}</p>
            </div>
          </div>
        )}
        
        {project.status && (
          <div className="absolute top-3 left-3">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </span>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <h3 className="mb-1 text-lg font-semibold tracking-tight truncate">
          {project.projectName}
        </h3>
        
        <div className="flex items-center mb-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="font-mono">{project.jobNumber}</span>
        </div>
        
        {project.clientName && (
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
            {project.clientName}
          </p>
        )}
        
        {project.description && (
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {project.description}
          </p>
        )}
        
        <div className="flex flex-col gap-2 mt-3">
          {project.location && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <MapPin className="w-3 h-3 mr-1" />
              <span className="truncate">
                {project.location.address || 
                  `${project.location.latitude.toFixed(4)}, ${project.location.longitude.toFixed(4)}`}
              </span>
            </div>
          )}
          
          {project.createdAt && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="w-3 h-3 mr-1" />
              <span>{formatDate(project.createdAt)}</span>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between p-4 pt-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(project)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <Edit className="w-4 h-4 mr-1" />
          Edit
        </Button>
        
        <Link href={`/view/${project.jobNumber}`} passHref>
          <Button
            variant="outline"
            size="sm"
            className="border-hwc-red/30 text-hwc-red hover:bg-hwc-red/10 hover:text-hwc-red hover:border-hwc-red"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            View
          </Button>
        </Link>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(project.jobNumber)}
          className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ProjectCard;
