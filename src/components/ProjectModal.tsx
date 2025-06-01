import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Search } from "lucide-react";
import { Project, CreateProjectData } from "@/types/project";
import { horizontalCRSOptions, verticalCRSOptions, geoidOptions } from "@/data/crsOptions";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectData) => void;
  project?: Project | null;
  mode: "create" | "edit";
}

export default function ProjectModal({ isOpen, onClose, onSubmit, project, mode }: ProjectModalProps) {
  const [formData, setFormData] = useState<CreateProjectData>({
    jobNumber: "",
    projectName: "",
    description: "",
    location: {
      latitude: 0,
      longitude: 0,
      address: "",
    },
    crs: {
      horizontal: "",
      vertical: "",
      geoidModel: "",
    },
    clientName: "",
    projectType: "",
    tags: [],
  });

  const [tagInput, setTagInput] = useState("");
  const [horizontalSearch, setHorizontalSearch] = useState("");
  const [verticalSearch, setVerticalSearch] = useState("");
  const [geoidSearch, setGeoidSearch] = useState("");

  useEffect(() => {
    if (project && mode === "edit") {
      setFormData({
        jobNumber: project.jobNumber,
        projectName: project.projectName,
        description: project.description || "",
        location: project.location || { latitude: 0, longitude: 0, address: "" },
        crs: project.crs || { horizontal: "", vertical: "", geoidModel: "" },
        clientName: project.clientName || "",
        projectType: project.projectType || "",
        tags: project.tags || [],
      });
    } else {
      setFormData({
        jobNumber: "",
        projectName: "",
        description: "",
        location: { latitude: 0, longitude: 0, address: "" },
        crs: { horizontal: "", vertical: "", geoidModel: "" },
        clientName: "",
        projectType: "",
        tags: [],
      });
    }
  }, [project, mode, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const filteredHorizontalOptions = horizontalCRSOptions.filter(option =>
    option.name.toLowerCase().includes(horizontalSearch.toLowerCase()) ||
    option.code.toLowerCase().includes(horizontalSearch.toLowerCase())
  );

  const filteredVerticalOptions = verticalCRSOptions.filter(option =>
    option.name.toLowerCase().includes(verticalSearch.toLowerCase()) ||
    option.code.toLowerCase().includes(verticalSearch.toLowerCase())
  );

  const filteredGeoidOptions = geoidOptions.filter(option =>
    option.name.toLowerCase().includes(geoidSearch.toLowerCase()) ||
    option.code.toLowerCase().includes(geoidSearch.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Project" : "Edit Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="jobNumber">Job Number *</Label>
              <Input
                id="jobNumber"
                value={formData.jobNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, jobNumber: e.target.value }))}
                required
                disabled={mode === "edit"}
              />
            </div>
            <div>
              <Label htmlFor="projectName">Project Name *</Label>
              <Input
                id="projectName"
                value={formData.projectName}
                onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientName">Client</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="projectType">Project Type</Label>
              <Select
                value={formData.projectType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, projectType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="survey">Survey</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="mapping">Mapping</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Location</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.location?.latitude || ""}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    location: { ...prev.location!, latitude: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.location?.longitude || ""}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    location: { ...prev.location!, longitude: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.location?.address || ""}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    location: { ...prev.location!, address: e.target.value }
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Coordinate Reference System</h3>
            
            <div>
              <Label>Horizontal CRS</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search horizontal CRS..."
                  value={horizontalSearch}
                  onChange={(e) => setHorizontalSearch(e.target.value)}
                  className="pl-10 mb-2"
                />
              </div>
              <Select
                value={formData.crs?.horizontal}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  crs: { ...prev.crs!, horizontal: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select horizontal CRS" />
                </SelectTrigger>
                <SelectContent>
                  {filteredHorizontalOptions.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.code} - {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Vertical CRS</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search vertical CRS..."
                  value={verticalSearch}
                  onChange={(e) => setVerticalSearch(e.target.value)}
                  className="pl-10 mb-2"
                />
              </div>
              <Select
                value={formData.crs?.vertical}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  crs: { ...prev.crs!, vertical: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vertical CRS" />
                </SelectTrigger>
                <SelectContent>
                  {filteredVerticalOptions.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.code} - {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Geoid Model</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search geoid model..."
                  value={geoidSearch}
                  onChange={(e) => setGeoidSearch(e.target.value)}
                  className="pl-10 mb-2"
                />
              </div>
              <Select
                value={formData.crs?.geoidModel}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  crs: { ...prev.crs!, geoidModel: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select geoid model" />
                </SelectTrigger>
                <SelectContent>
                  {filteredGeoidOptions.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.code} - {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} variant="outline">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags?.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-hwc-red hover:bg-hwc-red/90">
              {mode === "create" ? "Create Project" : "Update Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
