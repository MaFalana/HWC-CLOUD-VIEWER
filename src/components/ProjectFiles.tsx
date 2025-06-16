import { useState, useRef, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Input removed as it's unused
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Upload, 
  File, 
  Image, 
  MapPin, 
  Folder, 
  Download, 
  Trash2,
  X
} from "lucide-react";
import { Project, ProjectAttachment } from "@/types/project";
import { useToast } from "@/hooks/use-toast";

interface ProjectFilesProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

export default function ProjectFiles({ project, onUpdateProject }: ProjectFilesProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDescription, setUploadDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const attachments = project.attachments || [];

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <Image className="h-4 w-4" />; // lucide-react Image icon
      case "prj":
      case "jgw":
      case "tfw":
        return <MapPin className="h-4 w-4" />;
      case "pointcloud":
        return <Folder className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getFileTypeBadgeColor = (type: string) => {
    switch (type) {
      case "image":
        return "bg-blue-500";
      case "prj":
        return "bg-green-500";
      case "jgw":
      case "tfw":
        return "bg-yellow-500";
      case "pointcloud":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const determineFileType = (fileName: string): ProjectAttachment["type"] => {
    const extension = fileName.toLowerCase().split(".").pop();
    switch (extension) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "bmp":
      case "tiff":
      case "tif":
        return "image";
      case "prj":
        return "prj";
      case "jgw":
        return "jgw";
      case "tfw":
        return "tfw";
      case "las":
      case "laz":
      case "ply":
      case "pcd":
        return "pointcloud";
      default:
        return "other";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files);
    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
    setIsUploadModalOpen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;

    try {
      // In a real implementation, you would upload files to your backend/storage
      // For now, we'll simulate the upload and create attachment records
      const newAttachments: ProjectAttachment[] = uploadFiles.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        type: determineFileType(file.name),
        size: file.size,
        uploadedAt: new Date(),
        description: uploadDescription || undefined,
        // In real implementation, this would be the actual file URL after upload
        url: URL.createObjectURL(file)
      }));

      const updatedProject = {
        ...project,
        attachments: [...attachments, ...newAttachments],
        updatedAt: new Date()
      };

      onUpdateProject(updatedProject);

      toast({
        title: "Success",
        description: `${uploadFiles.length} file(s) uploaded successfully.`,
      });

      // Reset upload state
      setUploadFiles([]);
      setUploadDescription("");
      setIsUploadModalOpen(false);
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Error",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    const updatedProject = {
      ...project,
      attachments: attachments.filter(att => att.id !== attachmentId),
      updatedAt: new Date()
    };

    onUpdateProject(updatedProject);

    toast({
      title: "Success",
      description: "File deleted successfully.",
    });
  };

  const handleDownload = (attachment: ProjectAttachment) => {
    if (attachment.url) {
      // In a real implementation, this would download from your storage
      const link = document.createElement("a");
      link.href = attachment.url;
      link.download = attachment.name;
      link.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to upload
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Supports: JPG, PNG, PRJ, JGW, TFW, LAS, LAZ, PLY, and more
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                variant="outline"
              >
                <File className="h-4 w-4 mr-2" />
                Select Files
              </Button>
              <Button
                onClick={() => {
                  folderInputRef.current?.click();
                }}
                variant="outline"
              >
                <Folder className="h-4 w-4 mr-2" />
                Select Folder
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files);
              if (e.target.files && e.target.files.length > 0) {
                setIsUploadModalOpen(true);
              }
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory is a non-standard attribute but widely supported
            webkitdirectory="" 
            directory=""
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              handleFileSelect(e.target.files);
              if (e.target.files && e.target.files.length > 0) {
                setIsUploadModalOpen(true);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Project Files ({attachments.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <File className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No files uploaded yet</p>
              <p className="text-sm">Upload point cloud data, images, and reference files</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0">
                      {getFileTypeIcon(attachment.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {attachment.name}
                        </h4>
                        <Badge
                          className={`${getFileTypeBadgeColor(attachment.type)} text-white text-xs`}
                        >
                          {attachment.type.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{formatFileSize(attachment.size)}</span>
                        <span>
                          {new Date(attachment.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {attachment.description && (
                        <p className="text-xs text-gray-600 mt-1">
                          {attachment.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {attachment.url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(attachment)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Add a description for these files..."
                rows={2}
              />
            </div>

            <div>
              <Label>Selected Files ({uploadFiles.length})</Label>
              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
                {uploadFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {getFileTypeIcon(determineFileType(file.name))}
                      <span className="text-sm truncate">{file.name}</span>
                      <Badge
                        variant="outline"
                        className="text-xs"
                      >
                        {determineFileType(file.name).toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeUploadFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadModalOpen(false);
                setUploadFiles([]);
                setUploadDescription("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploadFiles.length === 0}>
              <Upload className="h-4 w-4 mr-2" />
              Upload {uploadFiles.length} File(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
