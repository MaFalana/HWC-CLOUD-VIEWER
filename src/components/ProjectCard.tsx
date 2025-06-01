: (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(project.acquistionDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          {project.clientName && (
            <div className="flex items-center gap-1">
              <span>Client: {project.clientName}</span>
            </div>
          )}
          {project.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {project.location.address || `${project.location.latitude}, ${project.location.longitude}`}
            </div>
          )}
        </div>

        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {project.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs bg-hwc-light text-hwc-dark">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-hwc-light text-hwc-dark">
                +{project.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button onClick={handleOpen} className="w-full bg-hwc-red hover:bg-hwc-red/90 text-white font-medium">
          <Eye className="h-4 w-4 mr-2" />
          Open
        </Button>
      </CardFooter>
    </Card>
  );
}
