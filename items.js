import fs from "fs/promises";
import path from "path";
import { API_BASE, makeApiCall, sleep } from "./common.js";

const ITEMS_FOLDER = "items";

async function fetchItemsForQuery(query) {
  console.log(`\nFetching items for query: "${query}"`);

  // Get first page to determine total pages
  const firstPage = await makeApiCall(
    `${API_BASE}/item/search?page=1&query=${query}`,
  );

  if (firstPage.items.length === 0) {
    console.log(`No items found for query "${query}"`);
    return [];
  }

  const totalPages = firstPage.pagination.last_page;
  const totalItems = firstPage.pagination.total;

  console.log(
    `Found ${totalItems} items across ${totalPages} pages for "${query}"`,
  );

  let allItems = [...firstPage.items];

  // Fetch remaining pages with rate limiting handled by makeApiCall
  for (let page = 2; page <= totalPages; page++) {
    console.log(`  Fetching page ${page}/${totalPages} for "${query}"...`);

    const pageData = await makeApiCall(
      `${API_BASE}/item/search?page=${page}&query=${query}`,
    );
    allItems.push(...pageData.items);

    console.log(
      `  Collected ${allItems.length}/${totalItems} items for "${query}"`,
    );
  }

  return allItems;
}

async function ensureItemsFolder() {
  await fs.access(ITEMS_FOLDER).catch(async () => {
    await fs.mkdir(ITEMS_FOLDER);
    console.log(`Created ${ITEMS_FOLDER} directory`);
  });
}

async function fetchAllItemsByAlphabet() {
  await ensureItemsFolder();

  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");

  console.log(`Starting to fetch items for each letter of the alphabet...`);

  for (const letter of alphabet) {
    console.log(`\n=== Processing letter: ${letter.toUpperCase()} ===`);

    const items = await fetchItemsForQuery(letter);

    if (items.length > 0) {
      const filename = path.join(ITEMS_FOLDER, `${letter}.json`);
      await fs.writeFile(filename, JSON.stringify(items, null, 2));
      console.log(`Saved ${items.length} items to ${filename}`);
    }

    // Small delay between letters
    await sleep(1000);
  }
}

async function combineAndDeduplicateItems() {
  console.log(`\n=== Combining and deduplicating items ===`);

  const itemsMap = new Map();
  const files = await fs.readdir(ITEMS_FOLDER);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  console.log(`Found ${jsonFiles.length} JSON files to process`);

  for (const file of jsonFiles) {
    const filePath = path.join(ITEMS_FOLDER, file);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const items = JSON.parse(fileContent);

    console.log(`Processing ${file}: ${items.length} items`);

    for (const item of items) {
      // Use hashed_id as the unique identifier
      if (!itemsMap.has(item.hashed_id)) {
        itemsMap.set(item.hashed_id, item);
      }
    }
  }

  const uniqueItems = Array.from(itemsMap.values());

  // Save deduplicated items
  await fs.writeFile("items.json", JSON.stringify(uniqueItems, null, 2));

  console.log(`\nDeduplication complete!`);
  console.log(`Total unique items: ${uniqueItems.length}`);
  console.log(`Saved to items.json`);

  return uniqueItems;
}

async function showStatistics(items) {
  const itemTypes = [...new Set(items.map((item) => item.type))];
  const qualities = [...new Set(items.map((item) => item.quality))];

  console.log(`\n=== Final Statistics ===`);
  console.log(`- Total unique items: ${items.length}`);
  console.log(`- Item types (${itemTypes.length}): ${itemTypes.join(", ")}`);
  console.log(
    `- Quality levels (${qualities.length}): ${qualities.join(", ")}`,
  );

  // Show top 10 most common types
  const typeCounts = {};
  items.forEach((item) => {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  });

  const sortedTypes = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  console.log(`\nTop item types:`);
  sortedTypes.forEach(([type, count]) => {
    console.log(`  ${type}: ${count} items`);
  });
}

async function main() {
  console.log("Starting IdleMMO item fetcher...");

  // Step 1: Fetch items for each letter
  await fetchAllItemsByAlphabet();

  // Step 2: Combine and deduplicate
  const uniqueItems = await combineAndDeduplicateItems();

  // Step 3: Show statistics
  await showStatistics(uniqueItems);

  console.log(`\n✅ Complete! All items saved to items.json`);
}

main();
