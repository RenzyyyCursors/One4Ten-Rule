(function () {
  console.log("[One4Ten] Content Script Loaded on LeetCode");

  let currentSlug = getProblemSlug();
  let timerInterval = null;
  let secondsRemaining = 1800; // default 30 mins
  let isTimerRunning = false;
  let alreadyMarkedAccepted = false;
  let currentProblemData = null;

  // Initial setup after DOM loads
  window.addEventListener("load", () => {
    initOverlay();
    observeSubmissions();
  });

  // Periodically check for SPA navigation across problems
  let lastPathname = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      currentSlug = getProblemSlug();
      alreadyMarkedAccepted = false;
      if (timerInterval) clearInterval(timerInterval);
      isTimerRunning = false;
      initOverlay();
    }
  }, 1500);

  function getProblemSlug() {
    const match = location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : null;
  }

  function initOverlay() {
    if (!currentSlug) return;

    // Remove existing container if present
    const existing = document.getElementById("one4ten-floating-root");
    if (existing) existing.remove();

    currentProblemData = FLAT_PROBLEMS_LIST.find(p => p.slug === currentSlug);

    let diffText = "MEDIUM";
    let diffClass = "diff-tag-medium";
    let durationMins = 30;

    if (currentProblemData) {
      diffText = currentProblemData.difficulty.toUpperCase();
      if (currentProblemData.difficulty === "Easy") {
        diffClass = "diff-tag-easy";
        durationMins = 15;
      } else if (currentProblemData.difficulty === "Medium") {
        diffClass = "diff-tag-medium";
        durationMins = 30;
      } else if (currentProblemData.difficulty === "Hard") {
        diffClass = "diff-tag-hard";
        durationMins = 45;
      }
    }

    secondsRemaining = durationMins * 60;

    const container = document.createElement("div");
    container.id = "one4ten-floating-root";
    container.className = "one4ten-floating-container";

    const badge = document.createElement("div");
    badge.id = "one4ten-floating-badge-box";
    badge.className = "one4ten-floating-badge";

    const titleText = currentProblemData ? `${currentProblemData.id}. ${currentProblemData.title}` : currentSlug;

    badge.innerHTML = `
      <div>
        <div class="one4ten-badge-title">
          <span>TIMER</span>
          <span class="one4ten-diff-tag ${diffClass}">${diffText} (${durationMins}M)</span>
        </div>
        <div style="font-size: 11px; color: #94a3b8; max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
          ${titleText}
        </div>
      </div>
      <div class="one4ten-badge-timer" id="one4ten-timer-display">${formatTime(secondsRemaining)}</div>
      <button class="one4ten-timer-btn" id="one4ten-btn-toggle" title="Start/Pause Timer">START</button>
      <button class="one4ten-timer-btn" id="one4ten-btn-reset" title="Reset Timer">RESET</button>
    `;

    container.appendChild(badge);
    document.body.appendChild(container);

    document.getElementById("one4ten-btn-toggle").addEventListener("click", toggleTimer);
    document.getElementById("one4ten-btn-reset").addEventListener("click", resetTimer);

    // Auto-start timer on problem page load for real OA simulation
    chrome.storage.local.get(["one4ten_autostart_timer"], (res) => {
      if (res["one4ten_autostart_timer"] !== false) {
        toggleTimer(); // Start timer automatically
      }
    });
  }

  function toggleTimer() {
    const btn = document.getElementById("one4ten-btn-toggle");
    if (isTimerRunning) {
      clearInterval(timerInterval);
      isTimerRunning = false;
      if (btn) btn.textContent = "START";
    } else {
      isTimerRunning = true;
      if (btn) btn.textContent = "PAUSE";
      timerInterval = setInterval(() => {
        if (secondsRemaining > 0) {
          secondsRemaining--;
          updateTimerDisplay();

          // Warning pulse when 2 minutes remaining
          if (secondsRemaining <= 120) {
            const badgeBox = document.getElementById("one4ten-floating-badge-box");
            if (badgeBox) badgeBox.classList.add("time-warning");
          }
        } else {
          clearInterval(timerInterval);
          isTimerRunning = false;
          if (btn) btn.textContent = "START";
          playAlarmSound();
          alert("Time is up! OA timer finished for " + (currentProblemData ? currentProblemData.title : currentSlug));
        }
      }, 1000);
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    const btn = document.getElementById("one4ten-btn-toggle");
    if (btn) btn.textContent = "START";

    const badgeBox = document.getElementById("one4ten-floating-badge-box");
    if (badgeBox) badgeBox.classList.remove("time-warning");

    let durationMins = 30;
    if (currentProblemData) {
      if (currentProblemData.difficulty === "Easy") durationMins = 15;
      if (currentProblemData.difficulty === "Medium") durationMins = 30;
      if (currentProblemData.difficulty === "Hard") durationMins = 45;
    }
    secondsRemaining = durationMins * 60;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const el = document.getElementById("one4ten-timer-display");
    if (!el) return;
    el.textContent = formatTime(secondsRemaining);
  }

  function formatTime(totalSecs) {
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // Web Audio API beep synthesizer for OA time-up alert
  function playAlarmSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.log("Audio play prevented:", e);
    }
  }

  // Observe LeetCode DOM for Accepted status
  function observeSubmissions() {
    const observer = new MutationObserver((mutations) => {
      if (alreadyMarkedAccepted) return;

      for (let mutation of mutations) {
        if (mutation.type === "childList" || mutation.type === "characterData") {
          const text = document.body.innerText;
          if (
            (text.includes("Accepted") && text.includes("Runtime")) ||
            document.querySelector('[data-e2e-locator="submission-result"]')
          ) {
            const acceptedElem = Array.from(document.querySelectorAll('span, div')).find(
              el => el.textContent.trim() === "Accepted" && el.children.length === 0
            );

            if (acceptedElem) {
              handleAcceptedSubmission();
              break;
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  async function handleAcceptedSubmission() {
    if (alreadyMarkedAccepted || !currentSlug) return;
    alreadyMarkedAccepted = true;

    // Pause timer when accepted!
    if (isTimerRunning) {
      clearInterval(timerInterval);
      isTimerRunning = false;
      const btn = document.getElementById("one4ten-btn-toggle");
      if (btn) btn.textContent = "START";
    }

    console.log("[One4Ten] Accepted submission detected for:", currentSlug);

    if (typeof markProblemBySlugOrTitle === "function") {
      const result = await markProblemBySlugOrTitle(currentSlug, "", true);
      showAcceptedToast(result ? result.taskType : 'new');
    } else {
      chrome.storage.local.get(["one4ten_completed_tasks"], (res) => {
        const completedMap = res["one4ten_completed_tasks"] || {};
        const problem = FLAT_PROBLEMS_LIST.find(p => p.slug === currentSlug);
        if (problem) {
          if (!completedMap[problem.id]) {
            completedMap[problem.id] = {};
          }
          completedMap[problem.id].newCompletedOn = new Date().toISOString();
          completedMap[problem.id].lastUpdated = new Date().toISOString();
          chrome.storage.local.set({ "one4ten_completed_tasks": completedMap }, () => {
            showAcceptedToast('new');
          });
        }
      });
    }
  }

  function showAcceptedToast(taskType) {
    const root = document.getElementById("one4ten-floating-root") || document.body;
    const toast = document.createElement("div");
    toast.className = "one4ten-accepted-toast";
    let taskLabel = "Spaced Repetition Queue";
    if (taskType === 'new') taskLabel = "New Daily Problem";
    if (taskType === 'rev4') taskLabel = "Day-4 Review";
    if (taskType === 'rev10') taskLabel = "Day-10 Review";

    toast.innerHTML = `
      <div>
        <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">ACCEPTED • MARKED COMPLETE</div>
        <div style="font-size: 11px; opacity: 0.9;">Task: ${taskLabel} • Timer Paused</div>
      </div>
    `;

    root.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 6000);
  }
})();
