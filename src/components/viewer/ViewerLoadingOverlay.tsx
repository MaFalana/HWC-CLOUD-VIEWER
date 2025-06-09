import Image from "next/image";
import { Project } from "@/types/project";

interface ViewerLoadingOverlayProps {
  projectData: Project | null;
  jobNumber: string | string[] | undefined;
  loadingMessage: string;
}

export default function ViewerLoadingOverlay({
  projectData,
  jobNumber,
  loadingMessage,
}: ViewerLoadingOverlayProps) {
  return (
    <div className="viewer-overlay">
      <div className="text-center">
        <Image
          src="/hwc-logo-4c-mbe1obbx.png"
          alt="HWC Engineering"
          width={200}
          height={67}
          priority
          className="mx-auto mb-4"
          style={{ width: "auto", height: "auto" }}
        />
        <h1 className="text-2xl font-semibold mb-2">
          {projectData?.projectName || (jobNumber ? `Project ${jobNumber}` : "Loading Project...")}
        </h1>
        <div className="w-80 mx-auto">
          <p className="text-hwc-light">{loadingMessage}</p>
        </div>
        <div className="mt-8 text-sm text-hwc-light">
          Powered by HWC Engineering
        </div>
      </div>
    </div>
  );
}