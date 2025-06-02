import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query;
  
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    // Use environment variable or fallback
    const apiKey = process.env.MAPTILER_API_KEY || "3zy0Sl3tcfZaOQFhQD8J";
    
    // Fix MapTiler API URL - use the correct endpoint format
    const cleanQuery = query.trim().replace(/\s+/g, ' ');
    const maptilerUrl = `https://api.maptiler.com/coordinates/search?query=${encodeURIComponent(cleanQuery)}&key=${apiKey}&limit=50`;
    
    console.log('MapTiler API URL:', maptilerUrl);
    
    const response = await fetch(maptilerUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "HWC-Engineering-Cloud-Viewer/1.0",
        "Referer": process.env.NEXT_PUBLIC_APP_URL || "https://3000-f0a01b49-bfe7-44d0-8749-fdd6f987a772.h1050.daytona.work"
      }
    });

    console.log('MapTiler response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MapTiler API error:', errorText);
      
      // Return fallback data instead of throwing error
      return res.status(200).json({
        results: [],
        total: 0,
        error: `MapTiler API error: ${response.status}`,
        fallback: true
      });
    }

    const data = await response.json();
    console.log('MapTiler response data:', data);
    
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    res.status(200).json(data);
  } catch (error) {
    console.error("Error proxying MapTiler request:", error);
    
    // Return fallback response instead of error
    res.status(200).json({ 
      results: [],
      total: 0,
      error: "Failed to fetch CRS data from MapTiler",
      message: error instanceof Error ? error.message : "Unknown error",
      fallback: true
    });
  }
}