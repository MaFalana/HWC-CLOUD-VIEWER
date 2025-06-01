import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Script from "next/script";
import { projectService } from "@/services/projectService";
import { Project } from "@/types/project";

// Define types for Potree
interface PointCloudMaterial {
  pointSizeType: number;
}

interface PointCloud {
  material: PointCloudMaterial;
}

interface PotreeViewer {
  setEDLEnabled: (enabled: boolean) => void;
  setFOV: (fov: number) => void;
  setPointBudget: (budget: number) => void;
  setDescription: (description: string) => void;
  loadGUI: (callback: () => void) => void;
  setLanguage: (lang: string) => void;
  toggleSidebar: () => void;
  scene: {
    addPointCloud: (pointcloud: PointCloud) => void;
  };
  fitToScreen: (padding: number) => void;
}

interface PotreeLoadEvent {
  pointcloud: PointCloud;
}

interface PotreeStatic {
  Viewer: new (element: HTMLElement | null) => PotreeViewer;
  PointSizeType: {
    ADAPTIVE: number;
  };
  loadPointCloud: (path: string, name: string, callback: (e: PotreeLoadEvent) => void) => void;
}

// Extend Window interface to include Potree
declare global {
  interface Window {
    Potree: PotreeStatic;
  }
}

export default function PotreeViewer() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string") return;

    const loadProject = async () => {
      try {
        setLoading(true);
        const projectData = await projectService.getProject(jobNumber);
        setProject(projectData);
      } catch (err) {
        console.error("Failed to load project:", err);
        setError("Failed to load project data");
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [jobNumber]);

  useEffect(() => {
    if (!jobNumber || typeof jobNumber !== "string" || loading) return;

    const initializePotree = async () => {
      try {
        const loadScript = (src: string): Promise<void> =>
          new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
              resolve();
              return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script ${src}`));
            document.body.appendChild(script);
          });

        const scripts = [
          "/potree/libs/jquery/jquery-3.1.1.min.js",
          "/potree/libs/spectrum/spectrum.js",
          "/potree/libs/jquery-ui/jquery-ui.min.js",
          "/potree/libs/other/BinaryHeap.js",
          "/potree/libs/tween/tween.min.js",
          "/potree/libs/d3/d3.js",
          "/potree/libs/proj4/proj4.js",
          "/potree/libs/openlayers3/ol.js",
          "/potree/libs/i18next/i18next.js",
          "/potree/libs/jstree/jstree.js",
          "/potree/build/potree/potree.js",
          "/potree/libs/plasio/js/laslaz.js",
          "/potree/libs/Cesium/Cesium.js",
          "/potree/libs/perfect-scrollbar/js/perfect-scrollbar.jquery.js",
          "/potree/libs/amcharts/amcharts.js",
          "/potree/libs/amcharts/serial.js",
          "/potree/libs/panzoom/panzoom.min.js",
          "/potree/libs/papa/papaparse.js"
        ];

        for (const src of scripts) {
          await loadScript(src);
        }

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4400";
        const cloudJsPath = `${baseUrl}/pointclouds/${jobNumber}/cloud.js`;
        const metadataPath = `${baseUrl}/pointclouds/${jobNumber}/metadata.json`;

        const response = await fetch(cloudJsPath, { method: "HEAD" });
        const pathToLoad = response.ok ? cloudJsPath : metadataPath;

        // Initialize Potree viewer
        const viewer = new window.Potree.Viewer(document.getElementById("potree_render_area"));
        viewer.setEDLEnabled(true);
        viewer.setFOV(60);
        viewer.setPointBudget(1_000_000);
        viewer.setDescription(project?.projectName || `Project ${jobNumber}`);
        
        viewer.loadGUI(() => {
          viewer.setLanguage("en");
          viewer.toggleSidebar();
        });

        const loadCallback = (e: PotreeLoadEvent) => {
          if (e.pointcloud) {
            viewer.scene.addPointCloud(e.pointcloud);
            e.pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
            viewer.fitToScreen(0.5);
          } else {
            console.error("Failed to load point cloud.");
            setError("Failed to load point cloud data");
          }
        };

        if (pathToLoad.endsWith("cloud.js")) {
          window.Potree.loadPointCloud(pathToLoad, "PointCloud", loadCallback);
        } else {
          window.Potree.loadPointCloud(metadataPath, jobNumber, loadCallback);
        }

      } catch (err) {
        console.error("Error initializing Potree:", err);
        setError("Failed to initialize point cloud viewer");
      }
    };

    initializePotree();

    return () => {
      // Cleanup scripts if needed
      const scripts = document.querySelectorAll('script[src*="/potree/"]');
      scripts.forEach(script => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
    };
  }, [jobNumber, loading, project]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading point cloud viewer...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Error Loading Viewer</h1>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{project?.projectName || `Project ${jobNumber}`} - HWC Cloud Viewer</title>
        <meta name="description" content="Point cloud viewer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      {/* Load Potree CSS */}
      <Script id="potree-styles">
        {`
          // Load required CSS files
          function loadCSS(url) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            document.head.appendChild(link);
          }
          
          loadCSS('/potree/build/potree/potree.css');
          loadCSS('/potree/libs/jquery-ui/jquery-ui.min.css');
          loadCSS('/potree/libs/openlayers3/ol.css');
          loadCSS('/potree/libs/spectrum/spectrum.css');
          loadCSS('/potree/libs/jstree/themes/mixed/style.css');
          loadCSS('/potree/libs/Cesium/Widgets/CesiumWidget/CesiumWidget.css');
          loadCSS('/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css');
        `}
      </Script>
      
      <div
        className="potree_container"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          left: 0,
          top: 0
        }}
      >
        <div
          id="potree_render_area"
          style={{
            backgroundImage: "url('/potree/build/potree/resources/images/background.jpg')",
            width: "100%",
            height: "100%"
          }}
        >
          <div id="sidebar_logo"></div>
        </div>
        <div id="potree_sidebar_container" />
      </div>
    </>
  );
}
