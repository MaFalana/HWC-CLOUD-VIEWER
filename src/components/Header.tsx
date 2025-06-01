import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Grid3X3, List, Map } from "lucide-react";
import Image from "next/image";

interface HeaderProps {
  onNewProject: () => void;
  onViewChange: (view: "card" | "list" | "map") => void;
  currentView: "card" | "list" | "map";
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

export default function Header({
  onNewProject,
  onViewChange,
  currentView,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}: HeaderProps) {
  return (
    <header className="bg-hwc-dark text-white px-6 py-4">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="/hwc-logo-4c-mbe1obbx.png"
            alt="HWC Engineering"
            width={120}
            height={40}
            priority
            style={{ width: "auto", height: "40px" }}
            className="h-10"
          />
          <h1 className="text-xl font-semibold font-heading">Cloud Viewer</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-80 bg-white text-black border-hwc-light focus:border-hwc-red"
            />
          </div>

          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-40 bg-white text-black border-hwc-light">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 bg-hwc-gray rounded-lg p-1">
            <Button
              variant={currentView === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewChange("card")}
              className="h-8 w-8 p-0 hover:bg-hwc-light/20"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={currentView === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewChange("list")}
              className="h-8 w-8 p-0 hover:bg-hwc-light/20"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={currentView === "map" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewChange("map")}
              className="h-8 w-8 p-0 hover:bg-hwc-light/20"
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={onNewProject} className="bg-hwc-red hover:bg-hwc-red/90 text-white font-medium">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>
    </header>
  );
}
