import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useRouter } from "next/router";

interface ViewerErrorOverlayProps {
  loadingError: string | null;
  onRetry: () => void;
}

export default function ViewerErrorOverlay({ loadingError, onRetry }: ViewerErrorOverlayProps) {
  const router = useRouter();

  return (
    <div className="viewer-overlay">
      <div className="text-center">
        <Image
          src="/hwc-logo-4c-mbe1obbx.png"
          alt="HWC Engineering"
          width={200}
          height={67}
          priority
          className="mx-auto mb-8"
          style={{ width: "auto", height: "auto" }}
        />
        <h1 className="text-2xl font-bold mb-4">Error Loading Viewer</h1>
        <p className="mb-6 text-hwc-light">{loadingError}</p>
        <div className="space-x-3">
          <Button
            onClick={onRetry}
            className="bg-hwc-red hover:bg-hwc-red/90"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="border-hwc-red text-hwc-red hover:bg-hwc-red hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}