document.addEventListener("DOMContentLoaded", async () => {
  console.log("[One4Ten Popup] Loading decluttered UI...");

  // selectedDay: what's displayed in the UI (can be overridden by PREV/NEXT nav)
  // Always initialise to real today ignoring any stale override from a previous session
  let selectedDay = await getRealDayNumber();
  let realToday = selectedDay;

  // Clear any stale override from a previous session on fresh open
  await setStorageData(STORAGE_KEYS.DAY_OVERRIDE, null);
  let activeProblemForNotes = null;

  // Header and Progress card click -> Switch to 16 Topics Roadmap tab
  const goToRoadmapTab = () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(c => c.classList.remove("active"));

    const btnRoadmap = document.getElementById("btn-tab-roadmap");
    const tabRoadmap = document.getElementById("tab-roadmap");
    if (btnRoadmap && tabRoadmap) {
      btnRoadmap.classList.add("active");
      tabRoadmap.classList.add("active");
    }
  };

  document.getElementById("top-header-clickable").addEventListener("click", goToRoadmapTab);
  
  // Stop propagation when clicking day selector so header click isn't triggered
  const dayBox = document.getElementById("day-selector-box");
  if (dayBox) {
    dayBox.addEventListener("click", (e) => e.stopPropagation());
  }

  // Initial UI Render
  await refreshUI();

  // Tab Navigation
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // Day Navigation Buttons
  document.getElementById("btn-prev-day").addEventListener("click", async () => {
    if (selectedDay > 1) {
      selectedDay--;
      await setStorageData(STORAGE_KEYS.DAY_OVERRIDE, selectedDay);
      await refreshUI();
    }
  });

  document.getElementById("btn-next-day").addEventListener("click", async () => {
    selectedDay++;
    await setStorageData(STORAGE_KEYS.DAY_OVERRIDE, selectedDay);
    await refreshUI();
  });

  document.getElementById("btn-reset-day-override").addEventListener("click", async () => {
    await setStorageData(STORAGE_KEYS.DAY_OVERRIDE, null);
    selectedDay = await getRealDayNumber();
    await refreshUI();
  });

  // Settings: Start Date
  const startDateInput = document.getElementById("setting-start-date");
  const storedStartDate = await getStorageData(STORAGE_KEYS.START_DATE, "");
  if (storedStartDate) startDateInput.value = storedStartDate;

  startDateInput.addEventListener("change", async (e) => {
    if (e.target.value) {
      await setStorageData(STORAGE_KEYS.START_DATE, e.target.value);
      await setStorageData(STORAGE_KEYS.DAY_OVERRIDE, null);
      selectedDay = await getRealDayNumber();
      await refreshUI();
    }
  });

  // Export / Import Data
  document.getElementById("btn-export-data").addEventListener("click", async () => {
    const allStorage = await new Promise(r => chrome.storage.local.get(null, r));
    const jsonStr = JSON.stringify(allStorage, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `one4ten_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFileInput = document.getElementById("file-import-input");
  document.getElementById("btn-import-data").addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        await new Promise(r => chrome.storage.local.set(importedData, r));
        await setStorageData(STORAGE_KEYS.DAY_OVERRIDE, null);
        alert("Backup imported successfully!");
        selectedDay = await getRealDayNumber();
        await refreshUI();
      } catch (err) {
        alert("Invalid JSON backup file!");
      }
    };
    reader.readAsText(file);
  });

  // Roadmap Filters & Search
  setupRoadmapControls();

  // Timer Tab Logic
  setupPopupTimer();

  // Notes Modal Logic
  setupNotesModal();

  async function refreshUI() {
    realToday = await getRealDayNumber(); // always real today, ignores override
    document.getElementById("current-day-num").textContent = `Day ${selectedDay}`;

    // Show reset button only when browsing a day that isn't real today
    const overrideBtn = document.getElementById("btn-reset-day-override");
    if (selectedDay !== realToday) {
      overrideBtn.style.display = "block";
    } else {
      overrideBtn.style.display = "none";
    }

    // Daily queue for the BROWSED day (may be past or future)
    const queueData = await getDailyQueue(selectedDay);
    renderDailyQueue(queueData);

    // Backlog always based on REAL today — browsing future days must NOT add fake overdue
    const backlogTasks = await getBacklogQueue();
    renderBacklogQueue(backlogTasks);

    // Render Progress & Stats
    await renderProgressAndStats();

    // Render 16 Topics Roadmap
    await renderRoadmap();
  }

  function renderDailyQueue(queueData) {
    const container = document.getElementById("queue-list-container");
    container.innerHTML = "";

    document.getElementById("today-queue-count").textContent = queueData.tasks.length;

    const bannerTextEl = document.getElementById("queue-banner-text");
    if (queueData.dayNumber <= 3) {
      bannerTextEl.textContent = `Day ${queueData.dayNumber}: 1 Problem (1 New)`;
    } else if (queueData.dayNumber <= 9) {
      bannerTextEl.textContent = `Day ${queueData.dayNumber}: 2 Problems (1 New + Day-4 Review)`;
    } else {
      bannerTextEl.textContent = `Day ${queueData.dayNumber}: 3 Problems (1 New + Day-4 + Day-10 Reviews)`;
    }

    if (queueData.tasks.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:16px; color:#64748b; font-size:11px;">No tasks assigned for Day ${queueData.dayNumber}.</div>`;
      return;
    }

    queueData.tasks.forEach(task => {
      const card = document.createElement("div");
      card.className = `task-card ${task.completed ? 'completed' : ''}`;

      let typeTagClass = 'tag-new';
      let typeText = 'NEW';
      if (task.type === 'rev4') {
        typeTagClass = 'tag-rev4';
        typeText = `REV (DAY ${task.originalDay})`;
      } else if (task.type === 'rev10') {
        typeTagClass = 'tag-rev10';
        typeText = `REV (DAY ${task.originalDay})`;
      }

      let diffClass = `diff-${task.problem.difficulty.toLowerCase()}`;

      card.innerHTML = `
        <div class="task-left">
          <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''}>
          <div class="task-info">
            <span class="task-tag ${typeTagClass}">${typeText}</span>
            <a href="https://leetcode.com/problems/${task.problem.slug}/" target="_blank" class="task-name">
              ${task.problem.id}. ${task.problem.title}
            </a>
            <div class="task-sub">
              <span class="${diffClass}">${task.problem.difficulty}</span>
              <span style="color:#64748b;">•</span>
              <span style="color:#94a3b8;">${task.problem.categoryName}</span>
            </div>
          </div>
        </div>
        <button class="btn-note-pill btn-notes" title="Notes">NOTES</button>
      `;

      card.querySelector(".task-check").addEventListener("change", async (e) => {
        await markTaskStatus(task.problem.id, queueData.dayNumber, task.type, e.target.checked);
        await refreshUI();
      });

      card.querySelector(".btn-notes").addEventListener("click", () => {
        openNotesModal(task.problem);
      });

      container.appendChild(card);
    });
  }

  function renderBacklogQueue(backlogTasks) {
    const wrapper = document.getElementById("backlog-wrapper");
    const container = document.getElementById("backlog-list-container");
    const countEl = document.getElementById("backlog-count");

    container.innerHTML = "";

    if (!backlogTasks || backlogTasks.length === 0) {
      wrapper.style.display = "none";
      return;
    }

    wrapper.style.display = "block";
    countEl.textContent = `${backlogTasks.length} missed`;

    backlogTasks.forEach(task => {
      const card = document.createElement("div");
      card.className = "task-card";

      let typeText = `MISSED DAY ${task.assignedDay}`;
      let diffClass = `diff-${task.problem.difficulty.toLowerCase()}`;

      card.innerHTML = `
        <div class="task-left">
          <input type="checkbox" class="task-check">
          <div class="task-info">
            <span class="task-tag tag-rev10">${typeText}</span>
            <a href="https://leetcode.com/problems/${task.problem.slug}/" target="_blank" class="task-name">
              ${task.problem.id}. ${task.problem.title}
            </a>
            <div class="task-sub">
              <span class="${diffClass}">${task.problem.difficulty}</span>
              <span style="color:#64748b;">•</span>
              <span style="color:#94a3b8;">${task.problem.categoryName}</span>
            </div>
          </div>
        </div>
        <button class="btn-note-pill btn-notes" title="Notes">NOTES</button>
      `;

      card.querySelector(".task-check").addEventListener("change", async (e) => {
        await markTaskStatus(task.problem.id, task.assignedDay, task.type, e.target.checked);
        await refreshUI();
      });

      card.querySelector(".btn-notes").addEventListener("click", () => {
        openNotesModal(task.problem);
      });

      container.appendChild(card);
    });
  }

  async function renderProgressAndStats() {
    const completedMap = await getStorageData(STORAGE_KEYS.COMPLETED_TASKS, {});
    const totalProblems = FLAT_PROBLEMS_LIST.length;

    let totalSolvedNew = 0;
    let totalSolvedRev4 = 0;
    let totalSolvedRev10 = 0;

    Object.values(completedMap).forEach(rec => {
      if (rec.newCompletedOn) totalSolvedNew++;
      if (rec.rev4CompletedOn) totalSolvedRev4++;
      if (rec.rev10CompletedOn) totalSolvedRev10++;
    });

    const percent = Math.round((totalSolvedNew / totalProblems) * 100);
    document.getElementById("overall-progress-text").textContent = `${percent}% (${totalSolvedNew}/${totalProblems})`;
    document.getElementById("overall-progress-bar").style.width = `${percent}%`;

    document.getElementById("stat-total-new").textContent = totalSolvedNew;
    document.getElementById("stat-total-rev4").textContent = totalSolvedRev4;
    document.getElementById("stat-total-rev10").textContent = totalSolvedRev10;
  }

  function setupRoadmapControls() {
    const catSelect = document.getElementById("filter-category");
    LEETCODE_DATABASE.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.category;
      opt.textContent = cat.category;
      catSelect.appendChild(opt);
    });

    document.getElementById("roadmap-search").addEventListener("input", renderRoadmap);
    catSelect.addEventListener("change", renderRoadmap);
    document.getElementById("filter-difficulty").addEventListener("change", renderRoadmap);
  }

  async function renderRoadmap() {
    const accordion = document.getElementById("roadmap-accordion");
    accordion.innerHTML = "";

    const searchVal = document.getElementById("roadmap-search").value.toLowerCase();
    const catVal = document.getElementById("filter-category").value;
    const diffVal = document.getElementById("filter-difficulty").value;

    const completedMap = await getStorageData(STORAGE_KEYS.COMPLETED_TASKS, {});

    LEETCODE_DATABASE.forEach(cat => {
      if (catVal !== "ALL" && cat.category !== catVal) return;

      const filteredProblems = cat.problems.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchVal) || p.id.toString().includes(searchVal);
        const matchesDiff = diffVal === "ALL" || p.difficulty === diffVal;
        return matchesSearch && matchesDiff;
      });

      if (filteredProblems.length === 0) return;

      const group = document.createElement("div");
      group.className = "cat-group";

      const solvedInCat = filteredProblems.filter(p => completedMap[p.id] && completedMap[p.id].newCompletedOn).length;

      const header = document.createElement("div");
      header.className = "cat-head";
      header.innerHTML = `
        <span>${cat.category}</span>
        <span style="font-size:10px; color:#38bdf8; font-weight:700;">${solvedInCat}/${filteredProblems.length}</span>
      `;

      const probList = document.createElement("div");
      probList.className = "cat-prob-list";

      filteredProblems.forEach(p => {
        const isSolved = completedMap[p.id] && completedMap[p.id].newCompletedOn;
        const diffClass = `diff-${p.difficulty.toLowerCase()}`;
        const row = document.createElement("div");
        row.className = "prob-row";
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" class="task-check" ${isSolved ? 'checked' : ''}>
            <a href="https://leetcode.com/problems/${p.slug}/" target="_blank">
              ${p.id}. ${p.title}
            </a>
          </div>
          <span class="${diffClass}">${p.difficulty}</span>
        `;

        row.querySelector(".task-check").addEventListener("change", async (e) => {
          await markTaskStatus(p.id, selectedDay, 'new', e.target.checked);
          await refreshUI();
        });

        probList.appendChild(row);
      });

      group.appendChild(header);
      group.appendChild(probList);
      accordion.appendChild(group);
    });
  }

  // Timer Functionality
  let popupSeconds = 1800;
  let popupTimerInterval = null;
  let popupTimerRunning = false;

  function setupPopupTimer() {
    const clock = document.getElementById("popup-clock");
    const startBtn = document.getElementById("popup-timer-start");
    const pauseBtn = document.getElementById("popup-timer-pause");
    const resetBtn = document.getElementById("popup-timer-reset");

    document.querySelectorAll(".segment-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".segment-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const mins = parseInt(btn.getAttribute("data-mins"), 10);
        popupSeconds = mins * 60;
        updateClockDisplay();
        if (popupTimerRunning) {
          clearInterval(popupTimerInterval);
          popupTimerRunning = false;
          startBtn.textContent = "Start Timer";
        }
      });
    });

    startBtn.addEventListener("click", () => {
      if (!popupTimerRunning) {
        popupTimerRunning = true;
        startBtn.textContent = "Running...";
        popupTimerInterval = setInterval(() => {
          if (popupSeconds > 0) {
            popupSeconds--;
            updateClockDisplay();
          } else {
            clearInterval(popupTimerInterval);
            popupTimerRunning = false;
            startBtn.textContent = "Start Timer";
            alert("Timer Finished!");
          }
        }, 1000);
      }
    });

    pauseBtn.addEventListener("click", () => {
      if (popupTimerRunning) {
        clearInterval(popupTimerInterval);
        popupTimerRunning = false;
        startBtn.textContent = "Resume";
      }
    });

    resetBtn.addEventListener("click", () => {
      clearInterval(popupTimerInterval);
      popupTimerRunning = false;
      startBtn.textContent = "Start Timer";
      const activeSegment = document.querySelector(".segment-btn.active");
      const mins = activeSegment ? parseInt(activeSegment.getAttribute("data-mins"), 10) : 30;
      popupSeconds = mins * 60;
      updateClockDisplay();
    });
  }

  function updateClockDisplay() {
    const clock = document.getElementById("popup-clock");
    const m = Math.floor(popupSeconds / 60).toString().padStart(2, '0');
    const s = (popupSeconds % 60).toString().padStart(2, '0');
    clock.textContent = `${m}:${s}`;
  }

  // Notes Modal Logic
  function setupNotesModal() {
    const modal = document.getElementById("notes-modal");
    const closeBtn = document.getElementById("notes-modal-close");
    const saveBtn = document.getElementById("notes-save-btn");

    closeBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });

    saveBtn.addEventListener("click", async () => {
      if (activeProblemForNotes) {
        const notesMap = await getStorageData(STORAGE_KEYS.PROBLEM_NOTES, {});
        const text = document.getElementById("notes-textarea").value;
        notesMap[activeProblemForNotes.id] = text;
        await setStorageData(STORAGE_KEYS.PROBLEM_NOTES, notesMap);
        modal.classList.remove("active");
      }
    });
  }

  async function openNotesModal(problem) {
    activeProblemForNotes = problem;
    const modal = document.getElementById("notes-modal");
    document.getElementById("notes-problem-title").textContent = `Notes: ${problem.id}. ${problem.title}`;
    const notesMap = await getStorageData(STORAGE_KEYS.PROBLEM_NOTES, {});
    document.getElementById("notes-textarea").value = notesMap[problem.id] || "";
    modal.classList.add("active");
  }
});
