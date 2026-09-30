# One4Ten — LeetCode Spaced Repetition Tracker 🧠🚀

**One4Ten** is a lightweight, privacy-focused Chrome Extension (Manifest V3) designed to optimize Data Structures and Algorithms (DSA) revision using the **1-4-10 Spaced Repetition System**.

Instead of grinding hundreds of problems and forgetting them weeks later, One4Ten ensures long-term retention by systematically queueing up past problems for revision on the **4th** and **10th** days.

---

## 📌 The 1-4-10 Learning System

* **Days 1 – 3 (Momentum Phase):**  
  `1 Problem / day` (1 New Problem)
* **Days 4 – 9 (First Revision Phase):**  
  `2 Problems / day` (1 New Problem + 1 Revision of Day `Current - 3`)
* **Days 10+ (Full Spaced Repetition):**  
  `3 Problems / day` (1 New Problem + 1 Revision of Day `Current - 3` + 1 Revision of Day `Current - 9`)

---

## ✨ Features

- **⚡ Automatic LeetCode Submission Detection:** Dynamically detects "Accepted" submissions directly on `leetcode.com/problems/*` pages and auto-marks the corresponding task as completed.
- **⏱️ Integrated OA Floating Timer:** Non-intrusive floating timer injected on LeetCode problem pages. Automatically defaults based on difficulty:
  - 🟢 **Easy:** 15 minutes
  - 🟡 **Medium:** 30 minutes
  - 🔴 **Hard:** 45 minutes
  Includes audio alerts (Web Audio API) when time runs out to simulate real Online Assessment (OA) environments.
- **🗺️ Complete 435+ Problem Roadmap:** Organized across 16 core DSA pattern categories (Arrays, Two Pointers, Sliding Window, DP, Graphs, Trees, etc.).
- **📋 Smart Backlog Queue:** Automatically aggregates overdue/missed tasks from past days without cluttering upcoming schedules when inspecting future days.
- **📝 Per-Problem Markdown Notes:** Save personal intuitions, time/space complexity, and pattern tricks for any problem.
- **💾 Import / Export Data:** Full JSON backup and restore capabilities via local storage.
- **🎨 Linear-Inspired Dark Theme:** Decluttered, high-contrast UI built with zero bloatware or heavy external frameworks.
- **🔒 100% Privacy & Local Storage:** No account needed, zero external server tracking. Everything stays locally on your system in `chrome.storage.local`.

---

## 🛠️ Tech Stack

- **Extension Framework:** Chrome Extension Manifest V3
- **Frontend / UI:** HTML5, Vanilla CSS3 (Custom CSS Variables, Dark Mode System), Vanilla JavaScript (ES6+)
- **DOM & Injections:** MutationObserver API, Web Audio API, Chrome Extension Content Scripts
- **Storage:** `chrome.storage.local` API

---

## 📦 Installation Guide

1. **Clone or Download this repository:**
   ```bash
   git clone https://github.com/your-username/One4Ten-Rule.git
   ```
2. **Open Chrome Extensions Manager:**
   Navigate to `chrome://extensions/` in your Chrome browser.
3. **Enable Developer Mode:**
   Toggle the **Developer mode** switch in the top-right corner.
4. **Load Unpacked Extension:**
   Click **Load unpacked** in the top-left corner and select the directory containing this project.
5. **Pin Extension:**
   Click the puzzle icon in Chrome's toolbar and pin **One4Ten**.

---

## 📁 Project Structure

```text
├── manifest.json       # Chrome Extension V3 Configuration
├── popup.html          # Extension Popup Interface
├── popup.css           # Minimalist Dark Theme Stylesheet
├── popup.js            # Main Extension UI Logic & Navigation
├── storage.js          # Core 1-4-10 Scheduling & Storage Engine
├── problems.js         # 435+ Curated Problem Database & Metadata
├── content.js          # LeetCode Page Overlay & Submission Listener
├── content.css         # Styling for Injected LeetCode Overlay
└── icons/              # Extension Icons (16x16, 48x48, 128x128)
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
