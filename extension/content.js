// IdleMMO Market Helper Content Script
let apiKey = null;
let currentItemId = null;
let currentTier = null;
let chartInstance = null;

// Chart.js is now loaded directly via manifest as UMD module
function loadChartJS() {
  return new Promise((resolve) => {
    // Chart.js UMD version should be available as window.Chart
    if (window.Chart) {
      console.log("IdleMMO Market Helper: Chart.js already loaded");
      resolve();
    } else {
      // Wait for Chart.js to load with polling
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      const checkChart = () => {
        if (window.Chart) {
          console.log("IdleMMO Market Helper: Chart.js loaded successfully");
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkChart, 100);
        } else {
          console.error("IdleMMO Market Helper: Failed to load Chart.js");
          resolve(); // Resolve anyway to not block the extension
        }
      };
      checkChart();
    }
  });
}

// Load API key from storage
chrome.storage.sync.get(["idleMmoApiKey"], function (result) {
  if (result.idleMmoApiKey) {
    apiKey = result.idleMmoApiKey;
    console.log("IdleMMO Market Helper: API key loaded");
  }
});

// Listen for API key updates from popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "apiKeyUpdated") {
    apiKey = request.apiKey;
    console.log("IdleMMO Market Helper: API key updated");
  }
});

// Function to extract item ID and tier from URL
function extractItemInfo(url) {
  try {
    // URL format: https://web.idle-mmo.com/item/inspect/DBngxedVYJqlNX64wW8o?tier=1&same_window=true
    const urlParts = url.split("/");
    const itemId = urlParts[urlParts.length - 1].split("?")[0]; // Get last part before query params

    const urlObj = new URL(url);
    const tier = urlObj.searchParams.get("tier");

    return { itemId, tier };
  } catch (error) {
    console.error("IdleMMO Market Helper: Error parsing URL:", error);
    return { itemId: null, tier: null };
  }
}

// Main function to inject market value
function injectMarketValue() {
  // Check if "Select an item" span exists - if so, do nothing
  const allSpans = document.querySelectorAll("span");
  for (const span of allSpans) {
    if (span.textContent && span.textContent.includes("Select an item")) {
      // Reset current item info when no item is selected
      currentItemId = null;
      currentTier = null;
      return;
    }
  }

  // Look for "Inspect" button by iterating through all buttons
  let inspectButton = null;
  const allButtons = document.querySelectorAll("button");
  for (const button of allButtons) {
    if (button.textContent && button.textContent.includes("Inspect")) {
      inspectButton = button;
      break;
    }
  }

  if (!inspectButton) {
    return;
  }

  // Get the href from the wrapping 'a' element
  const inspectLink = inspectButton.closest("a");
  if (!inspectLink || !inspectLink.href) {
    return;
  }

  // Extract item ID and tier from URL
  const { itemId, tier } = extractItemInfo(inspectLink.href);

  if (!itemId || !tier) {
    console.log(
      "IdleMMO Market Helper: Could not extract item info from URL:",
      inspectLink.href,
    );
    return;
  }

  // Check if this is the same item and tier as before
  if (currentItemId === itemId && currentTier === tier) {
    console.log("IdleMMO Market Helper: Same item and tier, skipping update");
    return;
  }

  // Update current item info
  currentItemId = itemId;
  currentTier = tier;

  console.log(
    "IdleMMO Market Helper: New item detected - ID:",
    itemId,
    "Tier:",
    tier,
  );

  // Fetch market data once and use for both injections
  if (apiKey) {
    fetchMarketDataOnce(itemId, tier);
  } else {
    // Handle no API key case for both injections
    injectMarketDataRows(itemId, tier, null);
    injectChartAnalysis(itemId, tier, null);
  }
}

// Function to fetch market data once and distribute to both UI components
async function fetchMarketDataOnce(itemId, tier) {
  try {
    console.log(
      "IdleMMO Market Helper: Fetching market data for item:",
      itemId,
      "tier:",
      tier,
    );

    // Make actual API call once
    const apiUrl = `http://localhost:8080/v1/item/${itemId}/market-history?tier=${tier}&type=listings`;
    console.log("IdleMMO Market Helper: API URL:", apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "IdleData/1.0.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Log the full response to console
    console.log("IdleMMO Market Helper: API Response:", data);

    // Inject both UI components with the same data
    injectMarketDataRows(itemId, tier, data);
    injectChartAnalysis(itemId, tier, data);
  } catch (error) {
    console.error("IdleMMO Market Helper: Error fetching market data:", error);
    // Inject UI components with error state
    injectMarketDataRows(itemId, tier, null, error);
    injectChartAnalysis(itemId, tier, null, error);
  }
}

// Function to inject market data rows in the original location
function injectMarketDataRows(itemId, tier, data = null, error = null) {
  // Find the target div with specific classes (original location)
  const targetDiv = document.querySelector(
    "div.w-full.divide-y.divide-gray-700\\/30",
  );
  if (!targetDiv) {
    console.log("IdleMMO Market Helper: Target div not found");
    return;
  }

  // Remove existing market value div if it exists (for updates)
  const existingDiv = targetDiv.querySelector(".market-value-injected");
  if (existingDiv) {
    existingDiv.remove();
  }

  // Create the market value div with multiple rows
  const marketValueDiv = document.createElement("div");
  marketValueDiv.className = "market-value-injected";

  // Define the rows to display
  const rows = [
    { label: "Latest Sold Median", className: "latest-sold-median" },
    { label: "Latest Sold Range", className: "latest-sold-range" },
    { label: "History Data Median", className: "history-data-median" },
  ];

  // Generate HTML for each row using a loop
  const rowsHtml = rows
    .map(
      (row) => `
    <div class="flex items-center justify-between">
        <div>
            <div class="flex items-center px-3 py-3 text-sm font-medium text-gray-300 rounded-md group">
                <span class="truncate">
                    ${row.label}
                </span>
            </div>
        </div>
        <div class="mr-4 font-semibold text-right text-gray-200 text-sm">
            <img src="https://cdn.idle-mmo.com/cdn-cgi/image/width=20,height=20/global/gold_coin.png" class="h-4 w-4 inline-block"> 
            <span class="${row.className}">Loading...</span>
        </div>
    </div>
  `,
    )
    .join("");

  marketValueDiv.innerHTML = rowsHtml;

  // Insert the div into the target container
  targetDiv.appendChild(marketValueDiv);

  console.log(
    "IdleMMO Market Helper: Market value rows injected for item:",
    itemId,
    "tier:",
    tier,
  );

  // Process the data directly instead of making another API call
  if (data) {
    processMarketDataForRows(data, marketValueDiv);
  } else if (error) {
    marketValueDiv.querySelector(".latest-sold-median").textContent = "Error";
    marketValueDiv.querySelector(".latest-sold-range").textContent = "Error";
    marketValueDiv.querySelector(".history-data-median").textContent = "Error";
  } else {
    marketValueDiv.querySelector(".latest-sold-median").textContent =
      "No API Key";
    marketValueDiv.querySelector(".latest-sold-range").textContent =
      "No API Key";
    marketValueDiv.querySelector(".history-data-median").textContent =
      "No API Key";
  }
}

// Function to inject chart analysis embedded in the page below inventory items
function injectChartAnalysis(itemId, tier, data = null, error = null) {
  // Find the game container
  const gameContainer = document.getElementById("game-container");
  if (!gameContainer) {
    console.log("IdleMMO Market Helper: Game container not found");
    return;
  }

  // Remove existing market analysis div if it exists (for updates)
  const existingDiv = document.querySelector(".market-analysis-injected");
  if (existingDiv) {
    existingDiv.remove();
  }

  // Create the market analysis container (chart only) - embedded, not overlay
  const marketAnalysisDiv = document.createElement("div");
  marketAnalysisDiv.className = "market-analysis-injected";
  marketAnalysisDiv.style.cssText = `
    width: 100%;
    max-width: 1200px;
    margin: 20px auto;
    background: rgba(17, 24, 39, 0.9);
    border: 1px solid rgba(75, 85, 99, 0.5);
    border-radius: 8px;
    padding: 20px;
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  `;

  marketAnalysisDiv.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h3 style="color: #f9fafb; margin: 0 0 15px 0; font-size: 18px; font-weight: 700;">Price Chart Analysis</h3>
    </div>
    <div style="display: flex; gap: 20px; margin-top: 20px;">
      <div style="flex: 1;">
        <div style="height: 400px; background: rgba(31, 41, 55, 0.8); border-radius: 4px; padding: 10px;">
          <canvas id="history-price-chart" style="width: 100%; height: 100%;"></canvas>
        </div>
      </div>
      <div style="flex: 1;">
        <div style="height: 400px; background: rgba(31, 41, 55, 0.8); border-radius: 4px; padding: 10px;">
          <canvas id="latest-sold-chart" style="width: 100%; height: 100%;"></canvas>
        </div>
      </div>
    </div>
  `;

  // Insert the div at the end of the game container (below all inventory items)
  gameContainer.appendChild(marketAnalysisDiv);

  console.log(
    "IdleMMO Market Helper: Chart analysis injected for item:",
    itemId,
    "tier:",
    tier,
  );

  // Process the data directly instead of making another API call
  if (data) {
    createPriceChart(data, marketAnalysisDiv);
  } else if (error) {
    console.log("IdleMMO Market Helper: Error state for chart");
  } else {
    console.log("IdleMMO Market Helper: No API key for chart");
  }
}

// Function to process market data for the rows display
function processMarketDataForRows(data, containerDiv) {
  const latestSoldMedianEl = containerDiv.querySelector(".latest-sold-median");
  const latestSoldRangeEl = containerDiv.querySelector(".latest-sold-range");
  const historyDataMedianEl = containerDiv.querySelector(
    ".history-data-median",
  );

  console.log("IdleMMO Market Helper: Processing market data for rows");
  console.log("IdleMMO Market Helper: Container div:", containerDiv);
  console.log(
    "IdleMMO Market Helper: Latest sold median element:",
    latestSoldMedianEl,
  );
  console.log(
    "IdleMMO Market Helper: Latest sold range element:",
    latestSoldRangeEl,
  );
  console.log(
    "IdleMMO Market Helper: History data median element:",
    historyDataMedianEl,
  );

  if (!latestSoldMedianEl || !latestSoldRangeEl || !historyDataMedianEl) {
    console.error(
      "IdleMMO Market Helper: Could not find all required elements for market data display",
    );
    return;
  }

  // Calculate median from latest_sold transactions
  const latestSold = data.latest_sold || [];

  console.log("IdleMMO Market Helper: Latest sold data:", latestSold);

  if (latestSold.length === 0) {
    latestSoldMedianEl.textContent = "No data";
    latestSoldRangeEl.textContent = "No data";
  } else {
    // Extract price_per_item values and sort them
    const prices = latestSold
      .map((transaction) => transaction.price_per_item)
      .filter((price) => price > 0)
      .sort((a, b) => a - b);

    console.log("IdleMMO Market Helper: Latest sold prices:", prices);

    if (prices.length > 0) {
      // Calculate median for latest sold
      const middle = Math.floor(prices.length / 2);
      let medianPrice = 0;
      if (prices.length % 2 === 0) {
        // Even number of prices - average of two middle values
        medianPrice = (prices[middle - 1] + prices[middle]) / 2;
      } else {
        // Odd number of prices - middle value
        medianPrice = prices[middle];
      }

      console.log("IdleMMO Market Helper: Latest sold median:", medianPrice);
      latestSoldMedianEl.textContent = Number(medianPrice).toLocaleString();

      // Calculate range for latest sold
      const minPrice = prices[0];
      const maxPrice = prices[prices.length - 1];
      latestSoldRangeEl.textContent = `${Number(
        minPrice,
      ).toLocaleString()} - ${Number(maxPrice).toLocaleString()}`;
    } else {
      latestSoldMedianEl.textContent = "No data";
      latestSoldRangeEl.textContent = "No data";
    }
  }

  // Calculate median from history_data
  const historyData = data.history_data || [];

  console.log("IdleMMO Market Helper: History data:", historyData);

  if (historyData.length === 0) {
    historyDataMedianEl.textContent = "No data";
  } else {
    // Extract average_price values and sort them
    const historyPrices = historyData
      .map((day) => day.average_price)
      .filter((price) => price > 0)
      .sort((a, b) => a - b);

    console.log("IdleMMO Market Helper: History prices:", historyPrices);

    if (historyPrices.length > 0) {
      // Calculate median for history data
      const middle = Math.floor(historyPrices.length / 2);
      let historyMedianPrice = 0;
      if (historyPrices.length % 2 === 0) {
        // Even number of prices - average of two middle values
        historyMedianPrice =
          (historyPrices[middle - 1] + historyPrices[middle]) / 2;
      } else {
        // Odd number of prices - middle value
        historyMedianPrice = historyPrices[middle];
      }

      console.log(
        "IdleMMO Market Helper: History data median:",
        historyMedianPrice,
      );
      historyDataMedianEl.textContent =
        Number(historyMedianPrice).toLocaleString();
    } else {
      historyDataMedianEl.textContent = "No data";
    }
  }
}

// Helper function to create a single chart
function createSingleChart(canvas, chartConfig) {
  const ctx = canvas.getContext("2d");

  // Calculate Y-axis range with padding
  const dataValues = chartConfig.datasets[0].data.filter((val) => val > 0);
  let yAxisConfig = {
    title: {
      display: true,
      text: chartConfig.yAxisTitle,
      color: "#f9fafb",
    },
    ticks: {
      color: "#d1d5db",
      callback: function (value) {
        return value.toLocaleString();
      },
    },
    grid: {
      color: "rgba(75, 85, 99, 0.3)",
    },
  };

  // Add padding to Y-axis if we have data
  if (dataValues.length > 0) {
    const minValue = Math.min(...dataValues);
    const maxValue = Math.max(...dataValues);
    const range = maxValue - minValue;

    // Handle case where all values are the same (range = 0)
    if (range === 0) {
      // For identical values, create a nice grid around the value
      const baseValue = minValue;
      let gridStep = 1;

      // Calculate appropriate grid step based on value magnitude
      if (baseValue >= 1000) {
        gridStep = 100;
      } else if (baseValue >= 100) {
        gridStep = 50;
      } else if (baseValue >= 10) {
        gridStep = 10;
      } else if (baseValue >= 1) {
        gridStep = 1;
      } else {
        gridStep = 0.1;
      }

      // Align to grid and add one step padding
      const gridMin = Math.floor(minValue / gridStep) * gridStep - gridStep;
      const gridMax = Math.ceil(maxValue / gridStep) * gridStep + gridStep;

      yAxisConfig.min = Math.max(0, gridMin);
      yAxisConfig.max = gridMax;
    } else {
      // Calculate suggested grid step based on range
      const roughGridStep = range / 5; // Aim for ~5 grid lines
      let gridStep = 1;

      // Find nice grid step (powers of 10, 2, or 5)
      const magnitude = Math.pow(10, Math.floor(Math.log10(roughGridStep)));
      const normalized = roughGridStep / magnitude;

      if (normalized <= 1) gridStep = magnitude;
      else if (normalized <= 2) gridStep = 2 * magnitude;
      else if (normalized <= 5) gridStep = 5 * magnitude;
      else gridStep = 10 * magnitude;

      // Align min/max to grid boundaries and add one step padding
      const gridMin = Math.floor(minValue / gridStep) * gridStep - gridStep;
      const gridMax = Math.ceil(maxValue / gridStep) * gridStep + gridStep;

      yAxisConfig.min = Math.max(0, gridMin);
      yAxisConfig.max = gridMax;
    }
  }

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: chartConfig.labels,
      datasets: chartConfig.datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartConfig.title,
          color: "#f9fafb",
        },
        legend: {
          display: true,
          labels: {
            color: "#f9fafb",
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: chartConfig.xAxisTitle,
            color: "#f9fafb",
          },
          ticks: {
            color: "#d1d5db",
            maxTicksLimit: chartConfig.maxXTicks || 10,
          },
          grid: {
            color: "rgba(75, 85, 99, 0.3)",
          },
        },
        y: yAxisConfig,
      },
    },
  });
}

// Helper function to show "no data" message on canvas
function showNoDataMessage(canvas, message) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f9fafb";
  ctx.font = "16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

// Function to create two separate price charts
async function createPriceChart(data, containerDiv) {
  try {
    // Load Chart.js if not already loaded
    await loadChartJS();

    // Get both canvas elements
    const historyCanvas = containerDiv.querySelector("#history-price-chart");
    const latestSoldCanvas = containerDiv.querySelector("#latest-sold-chart");

    if (!historyCanvas || !latestSoldCanvas) {
      console.log("IdleMMO Market Helper: Chart canvases not found");
      return;
    }

    // Destroy existing charts if they exist
    if (window.historyChartInstance) {
      window.historyChartInstance.destroy();
    }
    if (window.latestSoldChartInstance) {
      window.latestSoldChartInstance.destroy();
    }

    // Prepare data
    const historyData = data.history_data || [];
    const latestSold = data.latest_sold || [];

    // Create History Chart
    if (historyData.length > 0) {
      const historyLabels = historyData.map((item) => {
        const date = new Date(item.date);
        return date.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
        });
      });
      const historyPrices = historyData.map((item) => item.average_price || 0);

      const historyChartConfig = {
        type: "line",
        title: "Historical Price Trends",
        xAxisTitle: "Date",
        yAxisTitle: "Gold",
        maxXTicks: historyPrices.length + 1,
        labels: historyLabels,
        datasets: [
          {
            label: "Average Price",
            data: historyPrices,
            borderColor: "rgb(75, 192, 192)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.1,
            fill: true,
          },
        ],
      };

      window.historyChartInstance = createSingleChart(
        historyCanvas,
        historyChartConfig,
      );
    } else {
      showNoDataMessage(historyCanvas, "No historical data available");
    }

    // Create Latest Sold Chart
    if (latestSold.length > 0) {
      // Reverse the array so oldest transactions appear on the left (chronological order)
      const sortedLatestSold = [...latestSold].reverse();

      const latestLabels = sortedLatestSold.map((item) => {
        const date = new Date(item.sold_at);
        return date.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      });
      const latestPrices = sortedLatestSold.map(
        (item) => item.price_per_item || 0,
      );

      const latestSoldChartConfig = {
        type: "scatter",
        title: "Recent Transaction Prices",
        xAxisTitle: "Time",
        yAxisTitle: "Gold",
        maxXTicks: latestPrices.length + 1,
        labels: latestLabels,
        datasets: [
          {
            label: "Transaction Price",
            data: latestPrices,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.6)",
            tension: 0.1,
            fill: true,
          },
        ],
      };

      window.latestSoldChartInstance = createSingleChart(
        latestSoldCanvas,
        latestSoldChartConfig,
      );
    } else {
      showNoDataMessage(latestSoldCanvas, "No recent transactions available");
    }

    console.log("IdleMMO Market Helper: Dual charts created successfully");
  } catch (error) {
    console.error("IdleMMO Market Helper: Error creating charts:", error);
  }
}

// Run the injection function periodically to handle dynamic content
async function startMonitoring() {
  // Load Chart.js first
  try {
    await loadChartJS();
  } catch (error) {
    console.error("IdleMMO Market Helper: Failed to load Chart.js:", error);
  }

  // Run immediately
  injectMarketValue();

  // Set up a MutationObserver to watch for DOM changes
  const observer = new MutationObserver(function (mutations) {
    let shouldCheck = false;

    mutations.forEach(function (mutation) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        shouldCheck = true;
      }
    });

    if (shouldCheck) {
      setTimeout(injectMarketValue, 100); // Small delay to let DOM settle
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("IdleMMO Market Helper: Monitoring started");
}

// Wait for DOM to be fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMonitoring);
} else {
  startMonitoring();
}
