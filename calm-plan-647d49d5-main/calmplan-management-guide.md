# 📋 CalmPlan Project Master Document

## 🎯 Project Overview
**Project Name:** CalmPlan  
**Version:** 1.0.0  
**Last Updated:** 10/07/2025 - 09:00  
**Status:** In Active Development  
**Project Path:** `C:\calm-plan-647d49d5`  
**GitHub:** `https://github.com/base44dev/calm-plan-647d49d5.git`

### Project Description
Smart time management system for a user with ADHD, managing an accounting office, spouse in rehabilitation, 2 teenagers, and a large household.

---

## 🚨 CRITICAL PROJECT RULES

### 1. Code Management
- **NO** code modifications longer than 3 lines
- If changes > 3 lines → Create **NEW** file for copy/paste
- **ALWAYS** check if code already exists before creating
- File naming convention: `ComponentName.jsx` or `moduleName.js`

### 2. Working Protocol
1. **READ** all documentation first
2. **CHECK** existing code
3. **ASK** before creating
4. **SHOW** exact file path
5. **ONE** task at a time

### 3. Communication Rules
- You say: "I need to do X"
- Claude/BASE44 responds: "Here's the code, paste it in `path/to/file.js`"
- You: Copy → Paste → Confirm "DONE"
- **NO** explanations needed, just actions

### 4. Git & Saving (IMPORTANT UPDATE!)
- **BASE44 saves automatically** - every change is auto-committed
- **No manual git commands needed**
- **Everything is backed up** in BASE44's platform
- To export to GitHub: Ask BASE44 "Export project to GitHub"

---

## ✅ COMPLETED ITEMS (as of 09:00)

### Phase 1: Data Infrastructure ✅ **100% Complete**
- ✅ `entities/Task.json` - Extended with new fields
- ✅ `entities/WeeklySchedule.json` - Created
- ✅ `entities/FamilyMember.json` - Created
- ✅ `entities/DailyMoodCheck.json` - Created
- ✅ Interactive checklist in BASE44

### Phase 2a: UI Components - Household Tasks ✅ **100% Complete**
- ✅ **HouseholdTaskCard** - Task card with:
  - ✅ Checkbox for completion
  - ✅ Category-based colors
  - ✅ Drag and drop support
  - ✅ Clear icons
  - ✅ Click-to-edit functionality (NEW!)
- ✅ **HouseholdTaskBoard** - Dynamic task board
- ✅ **Tasks Page** - Tasks page with filtering and search
- ✅ **Git Update** - Performed by BASE44

---

## 🔄 CURRENT WORK IN PROGRESS

### Phase 2b: UI Components - Core System
- ⏳ **WeeklyPlanner** - The weekly scheduler - **NEXT UP!**
- ⬜ TreatmentInput - Treatment schedule input
- ⬜ FamilyDashboard - Family management board
- ⬜ DailyMoodTracker - Mood tracking

---

## 📋 NEXT IMMEDIATE TASK: WeeklyPlanner

### What to tell BASE44:
```
מעולה! סיימנו את HouseholdTaskCard עם העריכה.
עכשיו בואו נתחיל את WeeklyPlanner - זה הלב של המערכת.
צור קובץ חדש: src/components/scheduling/WeeklyPlanner.jsx
```

### WeeklyPlanner Requirements:
1. **Weekly Grid** - 5 days × 11 hours (8:00-18:00)
2. **Thursday Highlight** - Special color for treatment day
3. **Drag & Drop** - Like HouseholdTaskCard
4. **Fixed Blocks** - Non-movable treatments
5. **Task Sidebar** - Draggable pending tasks

### Key Features Checklist:
- [ ] Grid layout with time slots
- [ ] Day headers (Sunday-Thursday)
- [ ] Time column (8:00-18:00)
- [ ] Droppable zones for each time slot
- [ ] Fixed treatment blocks
- [ ] Draggable task cards
- [ ] Visual feedback on drag
- [ ] Thursday special styling
- [ ] Summary statistics

---

## 📊 PROJECT PROGRESS TRACKER

```
Overall Progress: ████████░░░░░░░░░░░░ 40%

✅ Data Models        [████████████████████] 100%
✅ Household Tasks    [████████████████████] 100%
⏳ Weekly Planner     [░░░░░░░░░░░░░░░░░░░░] 0%
⬜ Treatment Input    [░░░░░░░░░░░░░░░░░░░░] 0%
⬜ Family Dashboard   [░░░░░░░░░░░░░░░░░░░░] 0%
⬜ Mood Tracker       [░░░░░░░░░░░░░░░░░░░░] 0%
⬜ Monday.com         [░░░░░░░░░░░░░░░░░░░░] 0%
⬜ Scheduling Engine  [░░░░░░░░░░░░░░░░░░░░] 0%
```

---

## 🎯 QUICK REFERENCE

### Current Status:
- **Where:** WeeklyPlanner component
- **Who:** BASE44 creates UI, Claude provides logic
- **Time Estimate:** 3 hours
- **Priority:** CRITICAL - This is the core of the system!