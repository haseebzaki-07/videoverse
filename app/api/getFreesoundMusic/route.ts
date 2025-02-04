import { NextRequest, NextResponse } from "next/server";
import logger from "@/utils/logger";
import fs from "fs";
import path from "path";
import axios from "axios";

const FREESOUND_API_KEY = process.env.FREESOUND_API_KEY;
const FREESOUND_API_URL = "https://freesound.org/apiv2";

interface FreesoundResponse {
  results: Array<{
    id: number;
    name: string;
    duration: number;
    previews: {
      "preview-hq-mp3": string;
      "preview-lq-mp3": string;
    };
    tags: string[];
    license: string;
    url: string;
    type: string;
    download: string;
    username: string;
    description: string;
    avg_rating: number;
    num_ratings: number;
  }>;
  count: number;
}

interface SongQuery {
  keywords: string[];
  duration?: {
    min?: number;
    max?: number;
  };
  type?: string;
  sort?: "rating_desc" | "created_desc" | "downloads_desc" | "duration_desc";
  limit?: number;
}

async function downloadAndSaveSound(
  url: string,
  outputPath: string
): Promise<void> {
  try {
    const response = await axios({
      method: "get",
      url,
      responseType: "arraybuffer",
      headers: {
        Authorization: `Token ${FREESOUND_API_KEY}`,
      },
    });

    fs.writeFileSync(outputPath, response.data);
    logger.info("Sound file saved successfully", { outputPath });
  } catch (error) {
    logger.error("Error downloading sound", {
      error: error instanceof Error ? error.message : "Unknown error",
      url,
    });
    throw new Error("Failed to download sound file");
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || "";
    const filter = searchParams.get("filter") || "";
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || "15";

    if (!FREESOUND_API_KEY) {
      throw new Error("Freesound API key is not configured");
    }

    // Construct the search URL with parameters
    const searchUrl = new URL(`${FREESOUND_API_URL}/search/text/`);
    searchUrl.searchParams.append("query", query);
    searchUrl.searchParams.append("page", page);
    searchUrl.searchParams.append("page_size", pageSize);
    searchUrl.searchParams.append(
      "fields",
      "id,name,duration,previews,tags,license,url"
    );
    searchUrl.searchParams.append("filter", filter);

    logger.info("Fetching sounds from Freesound", {
      query,
      filter,
      page,
      pageSize,
    });

    // Make the request to Freesound API
    const response = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Token ${FREESOUND_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Freesound API error: ${response.statusText}`);
    }

    const data: FreesoundResponse = await response.json();

    // Transform the response to include only necessary data
    const transformedResults = data.results.map((sound) => ({
      id: sound.id,
      name: sound.name,
      duration: sound.duration,
      previewUrl: sound.previews["preview-hq-mp3"],
      tags: sound.tags,
      license: sound.license,
      url: sound.url,
    }));

    logger.info("Successfully fetched sounds from Freesound", {
      count: data.count,
      resultsCount: transformedResults.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        results: transformedResults,
        count: data.count,
      },
    });
  } catch (error) {
    logger.error("Error fetching sounds from Freesound", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch sounds from Freesound",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SongQuery = await request.json();
    const {
      keywords,
      duration,
      type = "music",
      sort = "rating_desc",
      limit = 5,
    } = body;

    if (!FREESOUND_API_KEY) {
      throw new Error("Freesound API key is not configured");
    }

    // Ensure the freesound directory exists
    const soundDir = path.join(process.cwd(), "public", "freesound");
    if (!fs.existsSync(soundDir)) {
      fs.mkdirSync(soundDir, { recursive: true });
    }

    // Function to make a search request with given parameters
    async function searchFreesound(
      searchQuery: string,
      searchFilter: string = ""
    ) {
      const searchUrl = new URL(`${FREESOUND_API_URL}/search/text/`);
      searchUrl.searchParams.append("query", searchQuery);
      searchUrl.searchParams.append(
        "fields",
        "id,name,duration,previews,tags,license,url,type,download,username,description,avg_rating,num_ratings"
      );
      if (searchFilter) {
        searchUrl.searchParams.append("filter", searchFilter);
      }
      searchUrl.searchParams.append("page_size", limit.toString());
      searchUrl.searchParams.append("sort", sort);

      logger.info("Attempting Freesound search", {
        searchQuery,
        searchFilter,
        searchUrl: searchUrl.toString(),
      });

      const response = await fetch(searchUrl.toString(), {
        headers: {
          Authorization: `Token ${FREESOUND_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Freesound API error response", {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        return null;
      }

      const data: FreesoundResponse = await response.json();
      return data.results.length > 0 ? data : null;
    }

    // Try different search strategies
    let data: FreesoundResponse | null = null;
    let searchAttempts = [];

    // Strategy 1: Try with all keywords joined by OR
    const query1 = keywords.join(" OR ");
    searchAttempts.push({ strategy: "all_keywords_or", query: query1 });
    data = await searchFreesound(query1);

    // Strategy 2: If that fails, try with just the first keyword
    if (!data && keywords.length > 0) {
      const query2 = keywords[0];
      searchAttempts.push({ strategy: "first_keyword", query: query2 });
      data = await searchFreesound(query2);
    }

    // Strategy 3: If that fails, try with just the type
    if (!data) {
      const query3 = type;
      searchAttempts.push({ strategy: "type_only", query: query3 });
      data = await searchFreesound(query3);
    }

    // Strategy 4: If all else fails, try a very broad search
    if (!data) {
      const query4 = "music";
      searchAttempts.push({ strategy: "broad_search", query: query4 });
      data = await searchFreesound(query4, "type:music");
    }

    if (!data || !data.results.length) {
      return NextResponse.json(
        {
          error: "No matching sounds found after multiple attempts",
          searchAttempts,
        },
        { status: 404 }
      );
    }

    // Get the best matching sound (first result due to sorting)
    const selectedSound = data.results[0];

    // Generate a safe filename
    const timestamp = Date.now();
    const safeName = selectedSound.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .substring(0, 50);
    const fileName = `freesound_${safeName}_${timestamp}.mp3`;
    const filePath = path.join(soundDir, fileName);

    // Download and save the preview file
    await downloadAndSaveSound(
      selectedSound.previews["preview-hq-mp3"],
      filePath
    );

    // Verify file exists and has size
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      throw new Error("Sound file was not saved properly");
    }

    const soundInfo = {
      id: selectedSound.id,
      name: selectedSound.name,
      duration: selectedSound.duration,
      localPath: `/freesound/${fileName}`,
      tags: selectedSound.tags,
      license: selectedSound.license,
      type: selectedSound.type,
      username: selectedSound.username,
      description: selectedSound.description,
      rating: {
        average: selectedSound.avg_rating,
        count: selectedSound.num_ratings,
      },
    };

    logger.info("Successfully downloaded and saved sound", {
      soundId: selectedSound.id,
      fileName,
      duration: selectedSound.duration,
      searchAttempts,
    });

    return NextResponse.json({
      success: true,
      data: {
        sound: soundInfo,
        query: {
          keywords,
          duration,
          type,
          sort,
        },
        searchAttempts,
      },
    });
  } catch (error) {
    logger.error("Error in getFreesoundMusic", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch and save sound",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
