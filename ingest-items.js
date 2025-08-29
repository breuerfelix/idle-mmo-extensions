import fs from "fs/promises";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const DATABASE_NAME = "market";
const COLLECTION_NAME = "items";

if (!MONGO_CONNECTION_STRING) {
  console.error(
    "Error: MONGO_CONNECTION_STRING environment variable is required",
  );
  process.exit(1);
}

// Function to create URL-friendly slugs
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

async function ingestItems() {
  let client;

  try {
    console.log("Reading items.json...");
    const itemsData = await fs.readFile("items.json", "utf-8");
    const items = JSON.parse(itemsData);

    console.log(`Found ${items.length} items to ingest`);

    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    client = new MongoClient(MONGO_CONNECTION_STRING);
    await client.connect();

    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Clear existing items (optional - remove this if you want to append)
    console.log("Clearing existing items...");
    await collection.deleteMany({});

    // Transform items for MongoDB - use hashed_id as the _id and add slug
    console.log("Transforming items and generating slugs...");
    const transformedItems = items.map((item) => ({
      ...item,
      _id: item.hashed_id,
      slug: slugify(item.name),
    }));

    // Check for slug uniqueness
    console.log("Checking slug uniqueness...");
    const slugCounts = {};
    const duplicateSlugs = [];

    transformedItems.forEach((item) => {
      if (slugCounts[item.slug]) {
        slugCounts[item.slug]++;
        if (slugCounts[item.slug] === 2) {
          duplicateSlugs.push(item.slug);
        }
      } else {
        slugCounts[item.slug] = 1;
      }
    });

    if (duplicateSlugs.length > 0) {
      console.warn(`⚠️  Found ${duplicateSlugs.length} duplicate slugs:`);
      duplicateSlugs.forEach((slug) => {
        const items = transformedItems.filter((item) => item.slug === slug);
        console.warn(
          `  - "${slug}" (${slugCounts[slug]} items):`,
          items.map((i) => i.name),
        );
      });
    } else {
      console.log("✅ All slugs are unique!");
    }

    const uniqueSlugs = new Set(transformedItems.map((item) => item.slug)).size;
    console.log(
      `Generated ${uniqueSlugs} unique slugs from ${transformedItems.length} items`,
    );

    // Insert items in batches for better performance
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < transformedItems.length; i += batchSize) {
      const batch = transformedItems.slice(i, i + batchSize);

      try {
        await collection.insertMany(batch, { ordered: false });
        inserted += batch.length;
        console.log(`Inserted ${inserted}/${transformedItems.length} items`);
      } catch (error) {
        // Handle duplicate key errors gracefully
        if (error.code === 11000) {
          console.warn(
            `Batch ${
              Math.floor(i / batchSize) + 1
            }: Some items already exist, skipping duplicates`,
          );
          inserted += batch.length;
        } else {
          throw error;
        }
      }
    }

    console.log(`\n✅ Successfully ingested ${inserted} items into MongoDB`);
    console.log(`Database: ${DATABASE_NAME}`);
    console.log(`Collection: ${COLLECTION_NAME}`);

    // Show some stats
    const totalCount = await collection.countDocuments();
    const sampleItem = await collection.findOne();

    // Check slug uniqueness in database
    const slugStats = await collection
      .aggregate([
        {
          $group: {
            _id: "$slug",
            count: { $sum: 1 },
            names: { $push: "$name" },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    console.log(`\nDatabase Stats:`);
    console.log(`- Total items in collection: ${totalCount}`);
    console.log(
      `- Unique slugs in database: ${await collection
        .distinct("slug")
        .then((slugs) => slugs.length)}`,
    );

    if (slugStats.length > 0) {
      console.log(`- ⚠️  Duplicate slugs in database: ${slugStats.length}`);
      slugStats.forEach((stat) => {
        console.log(
          `  - "${stat._id}" appears ${stat.count} times: ${stat.names.join(
            ", ",
          )}`,
        );
      });
    } else {
      console.log(`- ✅ All slugs in database are unique`);
    }

    console.log(`- Sample item:`, JSON.stringify(sampleItem, null, 2));
  } catch (error) {
    console.error("Error ingesting items:", error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log("MongoDB connection closed");
    }
  }
}

// Run the ingestion
console.log("Starting item ingestion...");
ingestItems();
