import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Constants
export const API_BASE = "https://api.idle-mmo.com/v1";
export const API_KEY = process.env.API_KEY;
export const USER_AGENT = "IdleData/0.0.1";
export const SLEEP_TIME = 3100; // Rate limit sleep time in milliseconds

// Validate required environment variables
if (!API_KEY) {
  console.error("Error: API_KEY environment variable is required");
  process.exit(1);
}

// Sleep utility function
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// General API call wrapper with automatic rate limiting
export async function makeApiCall(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`API Error ${response.status}: ${response.statusText}`);
    console.error(`Response body: ${errorBody}`);
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Sleep to avoid rate limiting
  await sleep(SLEEP_TIME);

  return data;
}
