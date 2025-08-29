import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { API_BASE, makeApiCall } from "./common.js";

// Load environment variables
dotenv.config();

const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const DATABASE_NAME = "market";

if (!MONGO_CONNECTION_STRING) {
  console.error(
    "Error: MONGO_CONNECTION_STRING environment variable is required",
  );
  process.exit(1);
}

async function fetchMarketData(itemId, tier, type) {
  const url = `${API_BASE}/item/${itemId}/market-history?tier=${tier}&type=${type}`;
  console.log(`Fetching ${type} data for item ${itemId} tier ${tier}...`);

  const data = await makeApiCall(url);
  return data.history_data || [];
}

async function ensureCollection(db, collectionName) {
  const collections = await db
    .listCollections({ name: collectionName })
    .toArray();
  if (collections.length === 0) {
    await db.createCollection(collectionName);
    console.log(`Created collection: ${collectionName}`);
  }
  return db.collection(collectionName);
}

async function insertHistoryData(collection, historyData, type) {
  if (!historyData || historyData.length === 0) {
    console.log(`No ${type} history data to insert`);
    return 0;
  }

  let insertedCount = 0;

  for (const dataPoint of historyData) {
    // Use date as unique identifier
    const result = await collection.updateOne(
      { date: dataPoint.date },
      {
        $set: dataPoint,
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      insertedCount++;
    }
  }

  return insertedCount;
}

async function processOreItems() {
  let client;

  // Connect to MongoDB
  console.log("Connecting to MongoDB...");
  client = new MongoClient(MONGO_CONNECTION_STRING);
  await client.connect();

  const db = client.db(DATABASE_NAME);
  const itemsCollection = db.collection("items");

  // Get all ORE items
  console.log("Fetching ORE items...");
  const oreItems = await itemsCollection.find({}).toArray();
  console.log(`Found ${oreItems.length} ORE items`);

  if (oreItems.length === 0) {
    console.log("No ORE items found in database");
    return;
  }

  // Process each ORE item
  for (let i = 0; i < oreItems.length; i++) {
    const item = oreItems[i];
    console.log(
      `\n=== Processing item ${i + 1}/${oreItems.length}: ${item.name} ===`,
    );

    // ORE items only have tier 0
    const tiers = [0];

    for (const tier of tiers) {
      console.log(`Processing tier ${tier} for ${item.name}...`);

      // Create collection names using hashed_id instead of slug
      const baseCollectionName = `${item.hashed_id}_${tier}`;
      const listingsCollectionName = `${baseCollectionName}_listings_history_data`;
      const ordersCollectionName = `${baseCollectionName}_orders_history_data`;

      // Fetch market data for both listings and orders
      const [listingsData, ordersData] = await Promise.all([
        fetchMarketData(item.hashed_id, tier, "listings"),
        fetchMarketData(item.hashed_id, tier, "orders"),
      ]);

      // Process listings data
      if (listingsData.length > 0) {
        const listingsCollection = await ensureCollection(
          db,
          listingsCollectionName,
        );
        const listingsInserted = await insertHistoryData(
          listingsCollection,
          listingsData,
          "listings",
        );
        console.log(`  Inserted ${listingsInserted} new listings data points`);
      }

      // Process orders data
      if (ordersData.length > 0) {
        const ordersCollection = await ensureCollection(
          db,
          ordersCollectionName,
        );
        const ordersInserted = await insertHistoryData(
          ordersCollection,
          ordersData,
          "orders",
        );
        console.log(`  Inserted ${ordersInserted} new orders data points`);
      }
    }
  }

  console.log("\n✅ Market data processing completed!");

  // Show collection stats
  const collections = await db.listCollections().toArray();
  const marketCollections = collections.filter((c) =>
    c.name.includes("_history_data"),
  );
  console.log(`\nCreated ${marketCollections.length} market data collections`);

  // Show sample of collections created
  if (marketCollections.length > 0) {
    console.log("\nSample collections:");
    marketCollections.slice(0, 5).forEach((collection) => {
      console.log(`  - ${collection.name}`);
    });
    if (marketCollections.length > 5) {
      console.log(`  ... and ${marketCollections.length - 5} more`);
    }
  }

  if (client) {
    await client.close();
    console.log("MongoDB connection closed");
  }
}

// Run the market data processing
console.log("Starting market data processing...");
processOreItems();
