const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to serve point cloud data
app.use('/pointclouds', express.static(path.join(__dirname, 'public/pointclouds')));

// API endpoint to get project info
app.get('/api/projects/:jobNumber', (req, res) => {
  const { jobNumber } = req.params;
  
  // Try to read project info from file
  const infoPath = path.join(__dirname, `public/pointclouds/${jobNumber}/info.json`);
  
  fs.readFile(infoPath, 'utf8', (err, data) => {
    if (err) {
      // If file doesn't exist, return a default project structure
      return res.json({
        jobNumber,
        projectName: `Project ${jobNumber}`,
        clientName: "HWC Engineering",
        acquistionDate: new Date().toISOString(),
        description: "Point cloud project",
        status: "active"
      });
    }
    
    try {
      const projectData = JSON.parse(data);
      res.json(projectData);
    } catch (parseError) {
      console.error("Error parsing project info:", parseError);
      res.status(500).json({ error: "Error parsing project info" });
    }
  });
});

// API endpoint to save project info (including CRS data)
app.post('/api/projects/:jobNumber', (req, res) => {
  const { jobNumber } = req.params;
  const projectData = req.body;
  
  // Ensure the project directory exists
  const projectDir = path.join(__dirname, `public/pointclouds/${jobNumber}`);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  
  // Save project info to file
  const infoPath = path.join(projectDir, 'info.json');
  
  try {
    // Add timestamp for update
    projectData.updatedAt = new Date().toISOString();
    
    // Write project data to file
    fs.writeFileSync(infoPath, JSON.stringify(projectData, null, 2));
    
    console.log(`Saved project info for ${jobNumber}:`, projectData);
    res.json({ success: true, message: "Project info saved successfully", data: projectData });
  } catch (error) {
    console.error(`Error saving project info for ${jobNumber}:`, error);
    res.status(500).json({ error: "Failed to save project info" });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Point cloud server is running' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Point cloud server running on port ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
  console.log(`Point cloud data available at: http://localhost:${PORT}/pointclouds`);
});
