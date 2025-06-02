import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Search, Loader2 } from "lucide-react";
import { Project, CreateProjectData, CRSOption } from "@/types/project";
import { arcgisService } from "@/services/arcgisService";

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

  // CRS options from ArcGIS API
  const [crsOptions, setCrsOptions] = useState<{
    horizontal: CRSOption[];
    vertical: CRSOption[];
    geoid: CRSOption[];
  }>({
    horizontal: [],
    vertical: [],
    geoid: []
  });

  const [crsLoading, setCrsLoading] = useState(false);
  const [crsError, setCrsError] = useState<string | null>(null);

  // Load CRS options when modal opens
  useEffect(() => {
    if (isOpen && crsOptions.horizontal.length === 0) {
      loadCRSOptions();
    }
  }, [isOpen]);

  // Set default CRS values for new projects
  useEffect(() => {
    if (mode === "create" && crsOptions.horizontal.length > 0 && !formData.crs?.horizontal) {
      // Set recommended defaults: Indiana East (ftUS) + NAVD88 (ftUS) + GEOID18
      const defaultHorizontal = crsOptions.horizontal.find(opt => opt.recommended)?.code || crsOptions.horizontal[0]?.code;
      const defaultVertical = crsOptions.vertical.find(opt => opt.recommended)?.code || crsOptions.vertical[0]?.code;
      const defaultGeoid = crsOptions.geoid.find(opt => opt.recommended)?.code || crsOptions.geoid[0]?.code;

      setFormData(prev => ({
        ...prev,
        crs: {
          horizontal: defaultHorizontal || "",
          vertical: defaultVertical || "",
          geoidModel: defaultGeoid || ""
        }
      }));
    }
  }, [mode, crsOptions, formData.crs?.horizontal]);

  const loadCRSOptions = async () => {
    setCrsLoading(true);
    setCrsError(null);
    
    try {
      const options = await arcgisService.getCRSOptions();
      setCrsOptions(options);
    } catch (error) {
      console.error("Failed to load CRS options:", error);
      setCrsError("Failed to load coordinate reference systems. Using fallback options.");
      
      // Use fallback options
      const fallback = arcgisService.getFallbackCRSOptions();
      setCrsOptions(fallback);
    } finally {
      setCrsLoading(false);
    }
  };

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
    } else if (mode === "create") {
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

  const filteredHorizontalOptions = horizontalSearch.trim() === "" 
    ? crsOptions.horizontal 
    : crsOptions.horizontal.filter(option =>
        option.name.toLowerCase().includes(horizontalSearch.toLowerCase()) ||
        option.code.toLowerCase().includes(horizontalSearch.toLowerCase())
      );

  const filteredVerticalOptions = verticalSearch.trim() === ""
    ? crsOptions.vertical
    : crsOptions.vertical.filter(option =>
        option.name.toLowerCase().includes(verticalSearch.toLowerCase()) ||
        option.code.toLowerCase().includes(verticalSearch.toLowerCase())
      );

  const filteredGeoidOptions = geoidSearch.trim() === ""
    ? crsOptions.geoid
    : crsOptions.geoid.filter(option =>
        option.name.toLowerCase().includes(geoidSearch.toLowerCase()) ||
        option.code.toLowerCase().includes(geoidSearch.toLowerCase())
      );

  const renderCRSSelect = (
    label: string,
    placeholder: string,
    searchValue: string,
    onSearchChange: (value: string) => void,
    selectValue: string | undefined,
    onSelectChange: (value: string) => void,
    options: CRSOption[],
    loading: boolean
  ) => (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={`Search ${label.toLowerCase()}...`}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 mb-2"
          disabled={loading}
        />
      </div>
      <Select
        value={selectValue}
        onValueChange={onSelectChange}
        disabled={loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Loading..." : placeholder} />
        </SelectTrigger>
        <SelectContent className="max-w-md">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading options...
            </div>
          ) : options.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No options available
            </div>
          ) : (
            options.map((option) => (
              <SelectItem key={option.code} value={option.code} className="py-3">
                <div className="flex items-start gap-3 w-full">
                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {option.code}
                      </span>
                      {option.recommended && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {option.name}
                    </div>
                    {option.description && (
                      <div className="text-xs text-gray-500 leading-relaxed">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {selectValue && (
        <div className="mt-2 p-3 bg-gray-50 rounded-md border">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-medium text-blue-600">
              {selectValue}
            </span>
            {options.find(opt => opt.code === selectValue)?.recommended && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Recommended
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-gray-900 mb-1">
            {options.find(opt => opt.code === selectValue)?.name}
          </div>
          {options.find(opt => opt.code === selectValue)?.description && (
            <div className="text-xs text-gray-600">
              {options.find(opt => opt.code === selectValue)?.description}
            </div>
          )}
        </div>
      )}
    </div>
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
              <Label htmlFor="acquistionDate">Acquisition Date</Label>
              <Input
                id="acquistionDate"
                type="date"
                value={formData.acquistionDate ? new Date(formData.acquistionDate).toISOString().split('T')[0] : ""}
                onChange={(e) => setFormData(prev => ({ ...prev, acquistionDate: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Coordinate Reference System</h3>
              {crsLoading && (
                <div className="flex items-center text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading CRS options...
                </div>
              )}
            </div>

            {crsError && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">{crsError}</p>
              </div>
            )}
            
            {renderCRSSelect(
              "Horizontal CRS",
              "Select horizontal CRS",
              horizontalSearch,
              setHorizontalSearch,
              formData.crs?.horizontal,
              (value) => setFormData(prev => ({
                ...prev,
                crs: { ...prev.crs!, horizontal: value }
              })),
              filteredHorizontalOptions,
              crsLoading
            )}

            {renderCRSSelect(
              "Vertical CRS",
              "Select vertical CRS",
              verticalSearch,
              setVerticalSearch,
              formData.crs?.vertical,
              (value) => setFormData(prev => ({
                ...prev,
                crs: { ...prev.crs!, vertical: value }
              })),
              filteredVerticalOptions,
              crsLoading
            )}

            {renderCRSSelect(
              "Geoid Model",
              "Select geoid model",
              geoidSearch,
              setGeoidSearch,
              formData.crs?.geoidModel,
              (value) => setFormData(prev => ({
                ...prev,
                crs: { ...prev.crs!, geoidModel: value }
              })),
              filteredGeoidOptions,
              crsLoading
            )}
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
