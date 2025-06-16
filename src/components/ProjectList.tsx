import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Eye, Edit, Trash2, MapPin, Calendar } from "lucide-react";
import { Project } from "@/types/project";
import { useRouter } from "next/router";

interface ProjectListProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (jobNumber: string) => void;
}

export default function ProjectList({ projects, onEdit, onDelete }: ProjectListProps) {
  const router = useRouter();

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

  return (
    <div className="bg-white rounded-lg shadow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Job Number</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Acquisition Date</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.jobNumber} className="hover:bg-gray-50">
              <TableCell>
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
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">{project.jobNumber}</TableCell>
              <TableCell>{project.clientName || "-"}</TableCell>
              <TableCell>
                {project.projectType ? (
                  <Badge variant="outline" className="capitalize">
                    {project.projectType}
                  </Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <Badge className={`${getStatusColor(project.status)} text-white`}>
                  {project.status}
                </Badge>
              </TableCell>
              <TableCell>
                {project.location ? (
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3" />
                    {project.location.address || 
                     `${project.location.latitude.toFixed(4)}, ${project.location.longitude.toFixed(4)}`}
                  </div>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="h-3 w-3" />
                  {project.acquistionDate ? new Date(project.acquistionDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC", // Display date as UTC
                  }) : "-"}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpen(project.jobNumber)}>
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
