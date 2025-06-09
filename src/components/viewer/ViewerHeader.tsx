import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Menu, X, MapPin, Info } from "lucide-react";
import { Project } from "@/types/project";
import { useRouter } from "next/router";

interface ViewerHeaderProps {
  projectData: Project | null;
  jobNumber: string | string[] | undefined;
  customSidebarVisible: boolean;
  onToggleCustomSidebar: () => void;
  onToggleProjectInfoPanel: () => void;
}

export default function ViewerHeader({
  projectData,
  jobNumber,
  customSidebarVisible,
  onToggleCustomSidebar,
  onToggleProjectInfoPanel,
}: ViewerHeaderProps) {
  const router = useRouter();

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-hwc-dark/95 backdrop-blur-md text-white border-b border-hwc-red/20">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-white hover:bg-hwc-red/20 font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <div className="h-6 w-px bg-hwc-gray/50"></div>
          <h1 className="text-xl font-semibold tracking-tight">
            {projectData?.projectName || (jobNumber ? `Project ${jobNumber}` : "Viewer")}
          </h1>
          {projectData?.location && (
            <div className="flex items-center gap-2 text-sm text-hwc-light/80">
              <MapPin className="h-3 w-3" />
              <span className="font-mono">
                {typeof projectData.location.latitude === "number" ? projectData.location.latitude.toFixed(4) : projectData.location.latitude}, 
                {typeof projectData.location.longitude === "number" ? projectData.location.longitude.toFixed(4) : projectData.location.longitude}
                {projectData.location.source && (
                  <span className="ml-2 text-xs opacity-60 bg-hwc-gray/20 px-2 py-1 rounded">
                    {projectData.location.source}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleProjectInfoPanel}
            className="text-white hover:bg-hwc-red/20"
            title="Project Information"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCustomSidebar}
            className="text-white hover:bg-hwc-red/20"
            title={customSidebarVisible ? "Hide Potree Sidebar" : "Show Potree Sidebar"}
          >
            {customSidebarVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <a 
            href="https://www.hwcengineering.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="cursor-pointer"
          >
            <Image
              src="/hwc-logo-4c-mbe1obbx.png"
              alt="HWC Engineering"
              width={100}
              height={34}
              priority
              className="h-8 hover:opacity-80 transition-opacity"
              style={{ width: "auto", height: "auto" }}
            />
          </a>
        </div>
      </div>
    </div>
  );
}