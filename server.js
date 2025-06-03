const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all routes
app.use(cors());

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
