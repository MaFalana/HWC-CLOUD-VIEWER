
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Project, CreateProjectData, CRSOption } from "@/types/project";
import { crsService } from "@/services/crsService";
import indianaData from "@/data/Indiana.json";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectData) => void;
  project: Project | null;
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

  // Add state to control dropdown open state
  const [horizontalOpen, setHorizontalOpen] = useState(false);
  const [verticalOpen, setVerticalOpen] = useState(false);
  const [geoidOpen, setGeoidOpen] = useState(false);

  // Search states for each dropdown
  const [horizontalSearch, setHorizontalSearch] = useState("");
  const [verticalSearch, setVerticalSearch] = useState("");
  const [geoidSearch, setGeoidSearch] = useState("");

  // CRS options from API and local data
  const [crsOptions, setCrsOptions] = useState<{
    horizontal: CRSOption[];
    vertical: CRSOption[];
    geoid: CRSOption[];
  }>({
    horizontal: [],
    vertical: [],
    geoid: []
  });

  // Convert Indiana.json data to CRSOption format
  const indianaCRSOptions: CRSOption[] = indianaData.results.map(item => ({
    code: `${item.id.authority}:${item.id.code}`,
    name: item.name,
    type: "horizontal", // All Indiana CRS options are horizontal
    description: item.area || "",
    recommended: false,
    bbox: item.bbox as [number, number, number, number]
  }));

  // Search results for horizontal CRS (filtered from Indiana data)
  const [horizontalSearchResults, setHorizontalSearchResults] = useState<CRSOption[]>([]);
  const [horizontalSearchLoading, setHorizontalSearchLoading] = useState(false);

  const [crsLoading, setCrsLoading] = useState(false);
  const [crsError, setCrsError] = useState<string | null>(null);

  // Filter Indiana CRS options based on search
  const filterIndianaOptions = useCallback((query: string): CRSOption[] => {
    if (!query.trim()) return indianaCRSOptions;
    
    const searchLower = query.toLowerCase();
    return indianaCRSOptions.filter(option => 
      option.code.toLowerCase().includes(searchLower) ||
      option.name.toLowerCase().includes(searchLower) ||
      (option.description && option.description.toLowerCase().includes(searchLower))
    );
  }, [indianaCRSOptions]);

  // Handle horizontal search input changes
  useEffect(() => {
    if (horizontalSearch.trim()) {
      setHorizontalOpen(true);
      setHorizontalSearchLoading(true);
      
      // Filter local Indiana data instead of API call
      const filteredResults = filterIndianaOptions(horizontalSearch);
      setHorizontalSearchResults(filteredResults);
      setHorizontalSearchLoading(false);
    } else {
      // When search is empty, show all Indiana options
      setHorizontalSearchResults([]);
      setHorizontalSearchLoading(false);
    }
  }, [horizontalSearch, filterIndianaOptions]);

  // Load initial CRS options when modal opens
  useEffect(() => {
    if (isOpen) {
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
      const options = await crsService.getAllCRSOptions();
      
      // Use Indiana data for horizontal CRS, API data for vertical and geoid
      setCrsOptions({
        horizontal: indianaCRSOptions,
        vertical: options.vertical,
        geoid: options.geoid
      });
    } catch (error) {
      console.error("Failed to load CRS options:", error);
      setCrsError("Failed to load coordinate reference systems. Using fallback options.");
      
      // Use fallback options with Indiana data for horizontal
      const fallback = crsService.getFallbackCRS();
      setCrsOptions({
        horizontal: indianaCRSOptions,
        vertical: fallback.vertical,
        geoid: fallback.geoid
      });
    } finally {
      setCrsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && project && mode === "edit") {
      setFormData({
        jobNumber: project.jobNumber,
        projectName: project.projectName,
        description: project.description || "",
        clientName: project.clientName || "",
        acquistionDate: project.acquistionDate,
        location: project.location || {
          latitude: 0,
          longitude: 0,
          address: "",
        },
        crs: project.crs || {
          horizontal: "",
          vertical: "",
          geoidModel: "",
        },
        projectType: project.projectType || "",
        tags: project.tags || [],
      });
    } else if (isOpen && mode === "create") {
      // Reset form for new project
      setFormData({
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
    }
  }, [isOpen, project, mode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location!,
        [name]: name === "address" ? value : parseFloat(value) || 0,
      },
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const renderHorizontalCRSSelect = () => {
    // Use search results if searching, otherwise use Indiana options
    const optionsToShow = horizontalSearch.trim() 
      ? horizontalSearchResults 
      : indianaCRSOptions;
    
    const selectedOption = [...indianaCRSOptions, ...horizontalSearchResults]
      .find(opt => opt.code === formData.crs?.horizontal);

    return (
      <div className="space-y-2">
        <Label>Horizontal CRS</Label>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search Indiana CRS options..."
            value={horizontalSearch}
            onChange={(e) => {
              setHorizontalSearch(e.target.value);
              // Always open dropdown when typing
              setHorizontalOpen(true);
            }}
            onFocus={() => setHorizontalOpen(true)}
            className="pl-10"
            autoComplete="off"
          />
        </div>

        {/* Selected Value Display */}
        {selectedOption && (
          <div className="p-3 bg-gray-50 rounded-md border">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-medium text-blue-600">
                {selectedOption.code}
              </span>
              {selectedOption.recommended && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Recommended
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-gray-900 mb-1">
              {selectedOption.name}
            </div>
            {selectedOption.description && (
              <div className="text-xs text-gray-600">
                {selectedOption.description}
              </div>
            )}
          </div>
        )}

        {/* Options List */}
        {horizontalOpen && (
          <div className="border rounded-md max-h-[300px] overflow-y-auto bg-white shadow-lg">
            {horizontalSearchLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>Searching...</span>
              </div>
            ) : optionsToShow.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {horizontalSearch.trim() ? "No results found" : "No options available"}
              </div>
            ) : (
              optionsToShow.map((option) => (
                <div
                  key={option.code}
                  className={`flex items-start gap-3 p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                    formData.crs?.horizontal === option.code ? "bg-blue-50" : ""
                  }`}
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      crs: { ...prev.crs!, horizontal: option.code }
                    }));
                    setHorizontalOpen(false);
                    setHorizontalSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mt-1 h-4 w-4 text-green-600",
                      formData.crs?.horizontal === option.code ? "opacity-100" : "opacity-0"
                    )}
                  />
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
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderVerticalCRSSelect = () => {
    const selectedOption = crsOptions.vertical.find(opt => opt.code === formData.crs?.vertical);

    return (
      <div className="space-y-2">
        <Label>Vertical CRS</Label>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search vertical CRS options..."
            value={verticalSearch}
            onChange={(e) => {
              setVerticalSearch(e.target.value);
              setVerticalOpen(true);
            }}
            onFocus={() => setVerticalOpen(true)}
            className="pl-10"
            autoComplete="off"
          />
        </div>

        {/* Selected Value Display */}
        {selectedOption && (
          <div className="p-3 bg-gray-50 rounded-md border">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-medium text-blue-600">
                {selectedOption.code}
              </span>
              {selectedOption.recommended && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Recommended
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-gray-900 mb-1">
              {selectedOption.name}
            </div>
            {selectedOption.description && (
              <div className="text-xs text-gray-600">
                {selectedOption.description}
              </div>
            )}
          </div>
        )}

        {/* Options List */}
        {verticalOpen && (
          <div className="border rounded-md max-h-[300px] overflow-y-auto bg-white shadow-lg">
            {crsOptions.vertical.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No vertical CRS options available
              </div>
            ) : (
              crsOptions.vertical
                .filter(option => 
                  !verticalSearch.trim() || 
                  option.code.toLowerCase().includes(verticalSearch.toLowerCase()) ||
                  option.name.toLowerCase().includes(verticalSearch.toLowerCase()) ||
                  (option.description && option.description.toLowerCase().includes(verticalSearch.toLowerCase()))
                )
                .map((option) => (
                  <div
                    key={option.code}
                    className={`flex items-start gap-3 p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      formData.crs?.vertical === option.code ? "bg-blue-50" : ""
                    }`}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        crs: { ...prev.crs!, vertical: option.code }
                      }));
                      setVerticalOpen(false);
                      setVerticalSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-1 h-4 w-4 text-green-600",
                        formData.crs?.vertical === option.code ? "opacity-100" : "opacity-0"
                      )}
                    />
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
                ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGeoidModelSelect = () => {
    const selectedOption = crsOptions.geoid.find(opt => opt.code === formData.crs?.geoidModel);

    return (
      <div className="space-y-2">
        <Label>Geoid Model</Label>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search geoid model options..."
            value={geoidSearch}
            onChange={(e) => {
              setGeoidSearch(e.target.value);
              setGeoidOpen(true);
            }}
            onFocus={() => setGeoidOpen(true)}
            className="pl-10"
            autoComplete="off"
          />
        </div>

        {/* Selected Value Display */}
        {selectedOption && (
          <div className="p-3 bg-gray-50 rounded-md border">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-medium text-blue-600">
                {selectedOption.code}
              </span>
              {selectedOption.recommended && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Recommended
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-gray-900 mb-1">
              {selectedOption.name}
            </div>
            {selectedOption.description && (
              <div className="text-xs text-gray-600">
                {selectedOption.description}
              </div>
            )}
          </div>
        )}

        {/* Options List */}
        {geoidOpen && (
          <div className="border rounded-md max-h-[300px] overflow-y-auto bg-white shadow-lg">
            {crsOptions.geoid.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No geoid model options available
              </div>
            ) : (
              crsOptions.geoid
                .filter(option => 
                  !geoidSearch.trim() || 
                  option.code.toLowerCase().includes(geoidSearch.toLowerCase()) ||
                  option.name.toLowerCase().includes(geoidSearch.toLowerCase()) ||
                  (option.description && option.description.toLowerCase().includes(geoidSearch.toLowerCase()))
                )
                .map((option) => (
                  <div
                    key={option.code}
                    className={`flex items-start gap-3 p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      formData.crs?.geoidModel === option.code ? "bg-blue-50" : ""
                    }`}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        crs: { ...prev.crs!, geoidModel: option.code }
                      }));
                      setGeoidOpen(false);
                      setGeoidSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-1 h-4 w-4 text-green-600",
                        formData.crs?.geoidModel === option.code ? "opacity-100" : "opacity-0"
                      )}
                    />
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
                ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Project" : "Edit Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="jobNumber">Job Number</Label>
                <Input
                  id="jobNumber"
                  name="jobNumber"
                  value={formData.jobNumber}
                  onChange={handleInputChange}
                  required
                  disabled={mode === "edit"}
                />
              </div>

              <div>
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  name="projectName"
                  value={formData.projectName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="projectType">Project Type</Label>
                <Select
                  value={formData.projectType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, projectType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="survey">Survey</SelectItem>
                    <SelectItem value="mapping">Mapping</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="acquistionDate">Acquisition Date</Label>
                <Input
                  id="acquistionDate"
                  name="acquistionDate"
                  type="date"
                  value={formData.acquistionDate ? new Date(formData.acquistionDate).toISOString().split('T')[0] : ""}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    placeholder="Add a tag"
                  />
                  <Button type="button" onClick={handleAddTag} variant="outline">
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="0.000001"
                  value={formData.location?.latitude || 0}
                  onChange={handleLocationChange}
                />
              </div>

              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="0.000001"
                  value={formData.location?.longitude || 0}
                  onChange={handleLocationChange}
                />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.location?.address || ""}
                  onChange={handleLocationChange}
                />
              </div>

              {crsError && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
                  {crsError}
                </div>
              )}

              {crsLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading coordinate systems...</span>
                </div>
              ) : (
                <>
                  {renderHorizontalCRSSelect()}
                  {renderVerticalCRSSelect()}
                  {renderGeoidModelSelect()}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {mode === "create" ? "Create Project" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
