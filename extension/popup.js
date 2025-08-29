document.addEventListener("DOMContentLoaded", function () {
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const statusDiv = document.getElementById("status");

  // Load saved API key on popup open
  chrome.storage.sync.get(["idleMmoApiKey"], function (result) {
    if (result.idleMmoApiKey) {
      apiKeyInput.value = result.idleMmoApiKey;
    }
  });

  // Save API key when button is clicked
  saveBtn.addEventListener("click", function () {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus("Please enter an API key", "error");
      return;
    }

    // Validate API key format (basic check)
    if (!apiKey.startsWith("idlemmo_")) {
      showStatus('API key should start with "idlemmo_"', "error");
      return;
    }

    // Save to Chrome storage
    chrome.storage.sync.set(
      {
        idleMmoApiKey: apiKey,
      },
      function () {
        if (chrome.runtime.lastError) {
          showStatus("Error saving API key", "error");
        } else {
          showStatus("API key saved successfully!", "success");

          // Notify content script about the updated API key
          chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
              if (
                tabs[0] &&
                tabs[0].url &&
                tabs[0].url.includes("web.idle-mmo.com")
              ) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: "apiKeyUpdated",
                  apiKey: apiKey,
                });
              }
            },
          );
        }
      },
    );
  });

  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";

    // Hide status after 3 seconds
    setTimeout(() => {
      statusDiv.style.display = "none";
    }, 3000);
  }

  // Save on Enter key
  apiKeyInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      saveBtn.click();
    }
  });
});
