import { Card, CardContent } from "@/components/ui/card";
import { Project } from "@/types/project";

interface ViewerProjectInfoPanelProps {
  projectData: Project | null;
}

export default function ViewerProjectInfoPanel({ projectData }: ViewerProjectInfoPanelProps) {
  if (!projectData) return null;

  return (
    <div className="absolute top-20 right-6 z-40 w-96">
      <Card className="bg-hwc-dark/95 backdrop-blur-md border border-hwc-red/20 text-black">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 text-lg">Project Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-hwc-red">Job Number:</span>
              <span className="font-mono">{projectData.jobNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-hwc-red">Project Name:</span>
              <span className="font-medium">{projectData.projectName}</span>
            </div>
            {projectData.clientName && (
              <div className="flex justify-between">
                <span className="text-hwc-red">Client:</span>
                <span>{projectData.clientName}</span>
              </div>
            )}
            {projectData.description && (
              <div>
                <span className="text-hwc-red">Description:</span>
                <p className="mt-1 text-xs leading-relaxed">{projectData.description}</p>
              </div>
            )}
            {projectData.location && (
              <div>
                <span className="text-hwc-red">Location:</span>
                <div className="mt-1 text-xs font-mono space-y-1">
                  <div>Lat: {typeof projectData.location.latitude === "number" ? projectData.location.latitude.toFixed(6) : projectData.location.latitude}</div>
                  <div>Lon: {typeof projectData.location.longitude === "number" ? projectData.location.longitude.toFixed(6) : projectData.location.longitude}</div>
                  {projectData.location.address && <div>Address: {projectData.location.address}</div>}
                  {projectData.location.source && (
                    <div className="text-hwc-red/60">
                      Source: {projectData.location.source} 
                      {projectData.location.confidence && ` (${projectData.location.confidence})`}
                    </div>
                  )}
                </div>
              </div>
            )}
            {projectData.crs && (
              <div>
                <span className="text-hwc-red">Coordinate System:</span>
                <div className="mt-1 text-xs space-y-1">
                  <div>Horizontal: <span className="font-mono">{projectData.crs.horizontal}</span></div>
                  {projectData.crs.vertical && <div>Vertical: <span className="font-mono">{projectData.crs.vertical}</span></div>}
                  {projectData.crs.geoidModel && <div>Geoid: <span className="font-mono">{projectData.crs.geoidModel}</span></div>}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}