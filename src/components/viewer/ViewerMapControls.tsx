import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type MapType = "default" | "terrain" | "satellite" | "openstreet";

interface ViewerMapControlsProps {
  currentMapType: MapType;
  onMapTypeChange: (mapType: MapType) => void;
}

export default function ViewerMapControls({ currentMapType, onMapTypeChange }: ViewerMapControlsProps) {
  const mapTypes: MapType[] = ["default", "terrain", "satellite", "openstreet"];

  return (
    <div className="absolute top-20 left-6 z-40">
      <Card className="bg-hwc-dark/95 backdrop-blur-md border border-hwc-red/20">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-2">
            {mapTypes.map((type) => (
              <Button
                key={type}
                variant={currentMapType === type ? "default" : "ghost"}
                size="sm"
                onClick={() => onMapTypeChange(type)}
                className={`text-xs h-9 ${currentMapType === type ? "bg-hwc-red hover:bg-hwc-red/90" : "text-white hover:bg-hwc-red/20"}`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}