import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query;
  
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    // Use the provided API key directly for now
    const apiKey = process.env.MAPTILER_API_KEY || "3zy0Sl3tcfZaOQFhQD8J";
    
    // Construct MapTiler API URL
    const maptilerUrl = `https://api.maptiler.com/coordinates/search/${encodeURIComponent(query)}.json?key=${apiKey}`;
    
    const response = await fetch(maptilerUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "HWC-Engineering-Cloud-Viewer/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`MapTiler API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Set CORS headers to allow frontend access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    res.status(200).json(data);
  } catch (error) {
    console.error("Error proxying MapTiler request:", error);
    res.status(500).json({ 
      error: "Failed to fetch CRS data from MapTiler",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}