// Storage Manager for One4Ten Extension

const STORAGE_KEYS = {
  START_DATE: "one4ten_start_date",
  COMPLETED_TASKS: "one4ten_completed_tasks",
  DAY_OVERRIDE: "one4ten_day_override",
  PROBLEM_NOTES: "one4ten_problem_notes",
  SETTINGS: "one4ten_settings"
};

async function getStorageData(key, defaultValue = null) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] !== undefined ? result[key] : defaultValue);
    });
  });
}

async function setStorageData(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve(true);
    });
  });
}

/**
 * Returns the REAL today's day number based on start date.
 * NEVER reads DAY_OVERRIDE — used for backlog and auto-marking.
 */
async function getRealDayNumber() {
  let startDateStr = await getStorageData(STORAGE_KEYS.START_DATE, null);
  if (!startDateStr) {
    const now = new Date();
    startDateStr = now.toISOString().slice(0, 10);
    await setStorageData(STORAGE_KEYS.START_DATE, startDateStr);
  }
  const startDate = new Date(startDateStr);
  const today = new Date();
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(Math.abs(today - startDate) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

/**
 * Returns the currently DISPLAYED day number.
 * Respects DAY_OVERRIDE for browsing — only used for the popup UI queue display.
 * DO NOT use this for backlog or auto-marking.
 */
async function getCurrentDayNumber() {
  const manualOverride = await getStorageData(STORAGE_KEYS.DAY_OVERRIDE, null);
  if (manualOverride !== null && parseInt(manualOverride, 10) > 0) {
    return parseInt(manualOverride, 10);
  }
  return getRealDayNumber();
}

/**
 * Calculates the Spaced Repetition Queue for a given display day.
 * Schedule:
 *   Days 1–3: 1 New Problem
 *   Days 4–9: 1 New + 1 Day-4 Review
 *   Days 10+:  1 New + 1 Day-4 Review + 1 Day-10 Review
 */
async function getDailyQueue(targetDay) {
  const day = targetDay;
  const completedMap = await getStorageData(STORAGE_KEYS.COMPLETED_TASKS, {});

  const queue = {
    dayNumber: day,
    tasks: []
  };

  // 1. New Problem for this day
  const newProblemIndex = day - 1;
  if (newProblemIndex >= 0 && newProblemIndex < FLAT_PROBLEMS_LIST.length) {
    const p = FLAT_PROBLEMS_LIST[newProblemIndex];
    const isCompleted = isTaskCompleted(completedMap, p.id, day, 'new');
    queue.tasks.push({
      type: 'new',
      label: `Day ${day} New Problem`,
      assignedDay: day,
      problem: p,
      completed: isCompleted
    });
  }

  // 2. Day-4 Review (only from Day 4 onwards)
  if (day >= 4) {
    const rev4Day = day - 3;
    const rev4ProblemIndex = rev4Day - 1;
    if (rev4ProblemIndex >= 0 && rev4ProblemIndex < FLAT_PROBLEMS_LIST.length) {
      const p = FLAT_PROBLEMS_LIST[rev4ProblemIndex];
      const isCompleted = isTaskCompleted(completedMap, p.id, day, 'rev4');
      queue.tasks.push({
        type: 'rev4',
        label: `Day-4 Review (from Day ${rev4Day})`,
        assignedDay: day,
        originalDay: rev4Day,
        problem: p,
        completed: isCompleted
      });
    }
  }

  // 3. Day-10 Review (only from Day 10 onwards)
  if (day >= 10) {
    const rev10Day = day - 9;
    const rev10ProblemIndex = rev10Day - 1;
    if (rev10ProblemIndex >= 0 && rev10ProblemIndex < FLAT_PROBLEMS_LIST.length) {
      const p = FLAT_PROBLEMS_LIST[rev10ProblemIndex];
      const isCompleted = isTaskCompleted(completedMap, p.id, day, 'rev10');
      queue.tasks.push({
        type: 'rev10',
        label: `Day-10 Review (from Day ${rev10Day})`,
        assignedDay: day,
        originalDay: rev10Day,
        problem: p,
        completed: isCompleted
      });
    }
  }

  return queue;
}

/**
 * Returns overdue/missed tasks from REAL past days only (Day 1 to realToday - 1).
 * Always uses getRealDayNumber() — never the browsed day override.
 * This ensures browsing future days never inflates the backlog.
 */
async function getBacklogQueue() {
  const realToday = await getRealDayNumber();
  const completedMap = await getStorageData(STORAGE_KEYS.COMPLETED_TASKS, {});
  const backlogTasks = [];

  // Only iterate days that have ACTUALLY passed (< realToday, not the browsed day)
  for (let pastDay = 1; pastDay < realToday; pastDay++) {
    // 1. New Problem backlog
    const newIdx = pastDay - 1;
    if (newIdx >= 0 && newIdx < FLAT_PROBLEMS_LIST.length) {
      const p = FLAT_PROBLEMS_LIST[newIdx];
      if (!isTaskCompleted(completedMap, p.id, pastDay, 'new')) {
        backlogTasks.push({
          type: 'new',
          assignedDay: pastDay,
          label: `Day ${pastDay} New Problem`,
          problem: p,
          completed: false
        });
      }
    }

    // 2. Day-4 Review backlog
    if (pastDay >= 4) {
      const rev4Day = pastDay - 3;
      const rev4Idx = rev4Day - 1;
      if (rev4Idx >= 0 && rev4Idx < FLAT_PROBLEMS_LIST.length) {
        const p = FLAT_PROBLEMS_LIST[rev4Idx];
        if (!isTaskCompleted(completedMap, p.id, pastDay, 'rev4')) {
          backlogTasks.push({
            type: 'rev4',
            assignedDay: pastDay,
            originalDay: rev4Day,
            label: `Day ${pastDay} Review (from Day ${rev4Day})`,
            problem: p,
            completed: false
          });
        }
      }
    }

    // 3. Day-10 Review backlog
    if (pastDay >= 10) {
      const rev10Day = pastDay - 9;
      const rev10Idx = rev10Day - 1;
      if (rev10Idx >= 0 && rev10Idx < FLAT_PROBLEMS_LIST.length) {
        const p = FLAT_PROBLEMS_LIST[rev10Idx];
        if (!isTaskCompleted(completedMap, p.id, pastDay, 'rev10')) {
          backlogTasks.push({
            type: 'rev10',
            assignedDay: pastDay,
            originalDay: rev10Day,
            label: `Day ${pastDay} Review (from Day ${rev10Day})`,
            problem: p,
            completed: false
          });
        }
      }
    }
  }

  return backlogTasks;
}

function isTaskCompleted(completedMap, problemId, day, taskType) {
  const pRecord = completedMap[problemId];
  if (!pRecord) return false;
  if (taskType === 'new') return !!pRecord.newCompletedOn;
  if (taskType === 'rev4') return !!pRecord.rev4CompletedOn;
  if (taskType === 'rev10') return !!pRecord.rev10CompletedOn;
  return false;
}

async function markTaskStatus(problemId, day, taskType, completedState = true) {
  const completedMap = await getStorageData(STORAGE_KEYS.COMPLETED_TASKS, {});
  if (!completedMap[problemId]) {
    completedMap[problemId] = {
      problemId,
      newCompletedOn: null,
      rev4CompletedOn: null,
      rev10CompletedOn: null,
      lastUpdated: new Date().toISOString()
    };
  }

  const record = completedMap[problemId];
  const timestamp = completedState ? new Date().toISOString() : null;

  if (taskType === 'new') record.newCompletedOn = timestamp;
  else if (taskType === 'rev4') record.rev4CompletedOn = timestamp;
  else if (taskType === 'rev10') record.rev10CompletedOn = timestamp;

  record.lastUpdated = new Date().toISOString();
  await setStorageData(STORAGE_KEYS.COMPLETED_TASKS, completedMap);
  return completedMap;
}

/**
 * Called from content.js on LeetCode submission acceptance.
 * Always uses getRealDayNumber() — never the override — so auto-marking
 * always lands on the real current day's queue.
 */
async function markProblemBySlugOrTitle(slug, title, isAccepted = true) {
  const targetProblem = FLAT_PROBLEMS_LIST.find(
    p => p.slug === slug || p.title.toLowerCase() === title.toLowerCase()
  );
  if (!targetProblem) return null;

  // Use REAL today, not the browsed/override day
  const realDay = await getRealDayNumber();
  const queue = await getDailyQueue(realDay);

  const matchedTask = queue.tasks.find(t => t.problem.id === targetProblem.id);
  if (matchedTask) {
    await markTaskStatus(targetProblem.id, realDay, matchedTask.type, isAccepted);
    return { problem: targetProblem, taskType: matchedTask.type, day: realDay };
  } else {
    // Solved from roadmap or outside today's queue — mark as new
    await markTaskStatus(targetProblem.id, realDay, 'new', isAccepted);
    return { problem: targetProblem, taskType: 'new', day: realDay };
  }
}
