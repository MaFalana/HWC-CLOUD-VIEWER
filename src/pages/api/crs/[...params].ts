import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { params } = req.query;
  
  if (!params || !Array.isArray(params)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  try {
    // Reconstruct the URL for epsg.io API
    const epsgUrl = `https://epsg.io/${params.join("/")}.json`;
    
    const response = await fetch(epsgUrl, {
      method: req.method,
      headers: {
        "Accept": "application/json",
        "User-Agent": "HWC-Engineering-Cloud-Viewer/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`EPSG API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Set CORS headers to allow frontend access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    res.status(200).json(data);
  } catch (error) {
    console.error("Error proxying EPSG request:", error);
    res.status(500).json({ 
      error: "Failed to fetch CRS data",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}