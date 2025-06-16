import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { getProjectById } from '../api/projects';

const JobPage: React.FC = () => {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [project, setProject] = useState(null);

  useEffect(() => {
    const fetchProject = async () => {
      const data = await getProjectById(jobNumber);
      setProject(data);
    };
    fetchProject();
  }, [jobNumber]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {project.clientName && (
            <span>Client: <span className="font-medium">{project.clientName}</span></span>
          )}
          {project.projectType && (
            <span>Type: <span className="font-medium capitalize">{project.projectType}</span></span>
          )}
          {project.acquistionDate && (
            <span>
              Acquired: <span className="font-medium">
                {new Date(project.acquistionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC", // Ensure UTC display
                })}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobPage;
