# CalmPlan - Developer Audit & Status Report
**Date:** 2026-02-11
**Auditor:** Claude Opus 4.6
**Branch:** `claude/resume-base44-system-ZnczH`

---

## Executive Summary

CalmPlan (LitayCalmPlan) is a React/Vite SPA for managing an accounting business + personal life. It uses localStorage as its data layer (migrated from Base44 SDK) with Monday.com API integration for bidirectional sync.

**Overall Health:** ~60% functional. Core pages work (Tasks, Clients, Calendar). Several pages are stubs or have dead treatment/therapy references. localStorage is the only persistence - no cloud backup.

---

## Architecture

| Layer | Technology | Status |
|-------|-----------|--------|
| UI | React 18 + Tailwind + Shadcn/ui + Framer Motion | Working |
| Routing | React Router 7.2.0 | Working |
| Data | localStorage via `localDB.js` | Working (fragile) |
| External API | Monday.com GraphQL v2 | Working (bidirectional) |
| Charts | Recharts | Working |
| DnD | @hello-pangea/dnd | Working |
| Deploy | Vercel | Configured |
| Language | Hebrew RTL | Working |

---

## Page-by-Page Status

### Legend
- **WORKS** = Fully functional, data connected
- **PARTIAL** = Loads but has issues or missing features
- **STUB** = Empty/placeholder, returns error or minimal UI
- **DEAD** = Should be removed (treatment/therapy remnants or unused)
- **NEEDS FIX** = Has a specific identified bug

---

### 1. Home (`/Home`) - Home.jsx [23K]
**Status: PARTIAL**
- Greeting, today's tasks, overdue tasks, quick stats - all work
- Data source: Task.filter by Dashboard board IDs - correct
- **Issue 1:** Quick action "תכנון שבועי" links to `/treatmentinput` - WRONG, should link to `/weeklyplanner`
- **Issue 2:** Description says "הזן טיפולים ויצור תכנון" - treatment language, needs update
- **Issue 3:** Lots of verbose console.log debug statements
- **Keep:** Yes, core page

### 2. Calendar (`/Calendar`) - Calendar.jsx [13K]
**Status: WORKS**
- Fixed in previous session: now uses `monday_board_id` filter
- Shows tasks and events on calendar
- Month/Week/Day views via sub-components
- **Keep:** Yes, core page

### 3. Tasks (`/Tasks`) - Tasks.jsx [22K]
**Status: PARTIAL**
- List + Kanban views work
- Filters by work/home context using Dashboard board IDs
- Status normalization from Hebrew Monday statuses works
- **Issue 1:** Lines 159-197 - massive console.log debug block loading ALL tasks/clients/reconciliations on every render. Causes unnecessary API calls and console spam
- **Issue 2:** `status_ne` filter used in BusinessHub call won't work with localDB (no `$ne` operator)
- **Keep:** Yes, core page. Remove debug code.

### 4. ClientManagement (`/ClientManagement`) - ClientManagement.jsx [36K]
**Status: WORKS**
- Full CRUD for clients
- Bidirectional Monday.com sync (added in previous session)
- 6 status types including "ממתין לקליטה"
- **Keep:** Yes, core page

### 5. WeeklySummary (`/WeeklySummary`) - WeeklySummary.jsx [16K]
**Status: WORKS**
- Shows overdue tasks grouped by client, completed this week, failed, upcoming
- Loads ALL tasks (Task.list 5000) - no board filter
- **Issue:** Loads all tasks without board filtering, so may show tasks from deleted boards
- **Keep:** Yes, useful page. Consider adding board filter.

### 6. WeeklyPlanningDashboard (`/WeeklyPlanningDashboard`) - WeeklyPlanningDashboard.jsx [13K]
**Status: WORKS**
- Completely rewritten in previous session
- Shows this week / next week comparison with workload indicators
- SMART recommendations
- **Keep:** Yes

### 7. WeeklyPlanner (`/WeeklyPlanner`) - pages/WeeklyPlanner.jsx [9K]
**Status: WORKS**
- Completely rewritten in previous session
- DnD grid with real tasks from Monday boards
- **Issue:** Scheduled tasks state is lost on refresh (not persisted)
- **Keep:** Yes

### 8. MondayIntegration (`/MondayIntegration`) - MondayIntegration.jsx [68K]
**Status: WORKS**
- Largest page - full Monday.com management
- Token config, board mapping, sync controls
- Imports Therapist entity (line 20) - still references therapy
- **Issue:** References `Therapist` and `WeeklySchedule` entities
- **Keep:** Yes, but clean therapy references

### 9. BusinessHub (`/BusinessHub`) - BusinessHub.jsx [18K]
**Status: PARTIAL**
- Dashboard for business operations
- "Generate tasks" button calls `generateProcessTasks` which is a STUB
- "Monthly reports" button calls `generateProcessTasks` which is a STUB
- `status_ne` filter won't work with localDB
- **Keep:** Yes, but fix stubs or remove broken buttons

### 10. Reconciliations (`/Reconciliations`) - Reconciliations.jsx [25K]
**Status: PARTIAL**
- Account reconciliation management
- Data loaded from AccountReconciliation entity
- **Keep:** Yes

### 11. ClientOnboarding (`/ClientOnboarding`) - ClientOnboarding.jsx [16K]
**Status: WORKS**
- Client intake wizard
- **Keep:** Yes

### 12. PayrollDashboard (`/PayrollDashboard`) - PayrollDashboard.jsx [8.6K]
**Status: PARTIAL**
- Payroll overview
- **Keep:** Yes

### 13. Leads (`/Leads`) - Leads.jsx [17K]
**Status: WORKS**
- Lead management with full CRUD
- Status pipeline: new_lead -> contacted -> quote_sent -> follow_up -> client_active / closed_lost
- **Keep:** Yes

### 14. ServiceProviders (`/ServiceProviders`) - ServiceProviders.jsx [12K]
**Status: WORKS**
- Service provider management
- **Keep:** Yes

### 15. ServiceProvidersPage (`/ServiceProvidersPage`) - ServiceProvidersPage.jsx [5.7K]
**Status: PARTIAL**
- Duplicate/alternative view of service providers
- **Consider:** Remove or merge with ServiceProviders

### 16. BalanceSheets (`/BalanceSheets`) - BalanceSheets.jsx [16K]
**Status: WORKS**
- Balance sheet tracking
- **Keep:** Yes

### 17. Roadmap (`/Roadmap`) - Roadmap.jsx [14K]
**Status: PARTIAL**
- Project roadmap view
- Uses RoadmapItem entity
- **Keep:** Yes

### 18. Settings (`/Settings`) - Settings.jsx [11K]
**Status: WORKS**
- Day schedule, meal reminders, break reminders
- Uses DaySchedule and WeeklyRecommendation entities
- **Keep:** Yes

### 19. Dashboards (`/Dashboards`) - Dashboards.jsx [8.2K]
**Status: WORKS**
- Charts: task status pie, weekly completion bar, work vs home pie
- Uses Recharts
- **Keep:** Yes

### 20. Analytics (`/Analytics`) - Analytics.jsx [14K]
**Status: PARTIAL**
- Productivity analysis, time tracking charts
- Uses TaskSession entity - may be empty if no sessions tracked
- **Keep:** Yes

### 21. TaskMatrix (`/TaskMatrix`) - TaskMatrix.jsx [6.2K]
**Status: WORKS**
- Eisenhower matrix for task prioritization
- **Keep:** Yes

### 22. Recommendations (`/Recommendations`) - Recommendations.jsx [20K]
**Status: PARTIAL**
- Smart recommendations based on task/event analysis
- References therapy: checks for "treatment sessions" in analysis
- **Issue:** Treatment-related recommendations still present in logic
- **Keep:** Yes, clean therapy references

### 23. NewEvent (`/NewEvent`) - NewEvent.jsx [28K]
**Status: WORKS**
- Event creation form
- **Keep:** Yes

### 24. Print (`/Print`) - Print.jsx [14K]
**Status: WORKS**
- Print-friendly views
- **Keep:** Yes

### 25. LifeSettings (`/LifeSettings`) - LifeSettings.jsx [26K]
**Status: PARTIAL**
- Personal settings (family, preferences)
- Uses FamilyMember entity
- **Keep:** Yes

### 26. MealPlanner (`/MealPlanner`) - MealPlanner.jsx [8.5K]
**Status: WORKS**
- Meal planning
- **Keep:** Yes

### 27. Inspiration (`/Inspiration`) - Inspiration.jsx [6.3K]
**Status: WORKS**
- Quotes and inspiration content
- **Keep:** Yes, personal feature

### 28. Collections (`/Collections`) - Collections.jsx [6.1K]
**Status: PARTIAL**
- Collection management
- **Keep:** Review if needed

### 29. HomeTaskGenerator (`/HomeTaskGenerator`) - HomeTaskGenerator.jsx [20K]
**Status: PARTIAL**
- Generates home/family tasks
- Calls `generateHomeTasks` which is a STUB
- **Issue:** Main function is a stub
- **Keep:** Fix or mark clearly as coming soon

### 30. SystemOverview (`/SystemOverview`) - SystemOverview.jsx [41K]
**Status: WORKS**
- System diagnostics, data counts, health checks
- References Therapist entity in data counts
- **Keep:** Yes, useful for debugging. Clean therapy refs.

### 31. EmergencyRecovery (`/EmergencyRecovery`) - EmergencyRecovery.jsx [12K]
**Status: WORKS**
- Data backup and recovery
- **Keep:** Yes, critical for localStorage-based system

### 32. EmergencyReset (`/EmergencyReset`) - EmergencyReset.jsx [6.6K]
**Status: WORKS**
- Nuclear reset option
- **Keep:** Yes

### 33. FullSync (`/FullSync`) - FullSync.jsx [7K]
**Status: WORKS**
- Full sync from Monday.com
- **Keep:** Yes

### 34. TestDataManager (`/TestDataManager`) - TestDataManager.jsx [20K]
**Status: WORKS**
- Demo data generation and management
- References Therapist
- **Keep:** Yes for development. Consider hiding in production nav.

---

### DEAD PAGES (Should Remove)

### 35. TreatmentInput (`/TreatmentInput`) - pages/TreatmentInput.jsx [763B]
**Status: DEAD - REMOVE**
- Thin wrapper that loads `components/scheduling/TreatmentInput.jsx` (36K)
- The TreatmentInput component is all about therapy scheduling (therapists, treatment types, therapy rooms)
- Not relevant to accounting business
- Home.jsx still links to it
- **Action:** Remove route + page. Fix Home.jsx link.

### 36. WeeklyPlanning (`/WeeklyPlanning`) - pages/WeeklyPlanning.jsx [763B]
**Status: DEAD - REMOVE**
- Exact same code as TreatmentInput page
- Both wrap `components/scheduling/TreatmentInput.jsx`
- **Action:** Remove route + page

### 37. RecurringTasks (`/RecurringTasks`) - RecurringTasks.jsx [697B]
**Status: PARTIAL**
- Wraps ClientRecurringTasks component
- The component itself may work
- **Keep:** Review ClientRecurringTasks component

---

## Components Audit

### DEAD Components (Should Remove)
| Component | Size | Reason |
|-----------|------|--------|
| `components/scheduling/TreatmentInput.jsx` | 36K | Entire therapy scheduling system - not relevant |
| `components/home/MoodTracker.jsx` | 4.2K | Not used by any page currently |
| `components/home/SmartNudge.jsx` | 1.4K | Not used by any page currently |

### Components to Clean
| Component | Issue |
|-----------|-------|
| `components/tasks/QuickTaskForm.jsx` | References treatment tasks |
| `components/notifications/AggressiveReminderSystem.jsx` | Check for therapy references |

---

## API Layer Audit

### localDB.js - WORKS
- Drop-in replacement for Base44 SDK
- All CRUD operations work
- Supports `$in` and `$eq` filter operators
- **Missing:** `$ne` (not equal) operator - used by BusinessHub, Calendar (already fixed in Calendar)

### entities.js - WORKS
- Exports all 25 entity types
- **Dead entities:** `Therapist`, `WeeklySchedule` (therapy-related)

### functions.js - PARTIAL
Working functions:
- `mondayBoardApi` (getAllBoards)
- `mondayApi` (syncClients, syncTasks, syncReconciliations, syncClientAccounts, syncTherapists, purgeAndResync, syncAllBoards, emergencyCleanup, pushClientToMonday, pushTaskToMonday, reverseSyncAllBoards)
- `emergencyBackup`, `emergencyReset`
- `seedData`

**STUBS (return error):**
| Function | Used By | Priority |
|----------|---------|----------|
| `createMonthlyBoards` | MondayIntegration | HIGH |
| `generateProcessTasks` | BusinessHub | MEDIUM |
| `generateHomeTasks` | HomeTaskGenerator | LOW |
| `getWeeklyPlan` | TreatmentInput (dead) | REMOVE |
| `createWeeklyPlan` | TreatmentInput (dead) | REMOVE |
| `importClientsFromExcel` | MondayIntegration | LOW |
| `exportClientsToExcel` | MondayIntegration | LOW |
| `importClientAccounts` | MondayIntegration | LOW |
| `exportClientAccountsTemplate` | MondayIntegration | LOW |
| `syncClientIdsToReports` | - | REMOVE |
| `priceWiseApi` | - | LOW |
| `mondayReportsAutomation` | BusinessHub | MEDIUM |

### mondayClient.js - WORKS
- Full GraphQL client for Monday.com API v2
- Token management in localStorage
- Rate limiting handling
- Bidirectional sync (added in previous session)
- Status mapping (Hebrew <-> English)

---

## Navigation Audit (Layout.jsx)

### "ניהול יומי" (Daily Management)
| Item | Route | Status |
|------|-------|--------|
| בית | /home | WORKS |
| דשבורד שבועי חכם | /weeklyplanningdashboard | WORKS |
| תכנון שבועי | /weeklyplanner | WORKS |
| משימות | /tasks | WORKS |
| סיכום שבועי | /weeklysummary | WORKS |
| לוח שנה | /calendar | WORKS |

### "העסק שלי" (My Business)
| Item | Route | Status |
|------|-------|--------|
| מרכז העסק | /businesshub | PARTIAL (stub buttons) |
| כל הלקוחות | /clientmanagement | WORKS |
| ניהול חוזים | /clientcontracts | NO PAGE EXISTS |
| לידים | /leads | WORKS |
| הצעות מחיר | /quotes | NO PAGE EXISTS |
| חוזים והסכמים | /newclientcontracts | NO PAGE EXISTS |
| קליטת לקוח חדש | /clientonboarding | WORKS |
| PriceWise אינטגרציה | /pricewiseintegration | NO PAGE EXISTS |
| שכר ודיווחים | /payrolldashboard | PARTIAL |
| לוח התאמות | /reconciliations | PARTIAL |
| מעקב מאזנים שנתיים | # (external) | BROKEN LINK |
| משימות חוזרות | /recurringtasks | PARTIAL |
| ספקים ונותני שירותים | /serviceproviders | WORKS |
| ניהול אינטגרציה | /mondayintegration | WORKS |
| מצב המערכת | /systemoverview | WORKS |

### "הבית והמשפחה" (Home & Family)
| Item | Route | Status |
|------|-------|--------|
| תכנון ארוחות | /mealplanner | WORKS |
| השראה וספרים | /inspiration | WORKS |
| הגדרות אישיות | /lifesettings | PARTIAL |

### "תובנות ופיתוח" (Insights & Development)
| Item | Route | Status |
|------|-------|--------|
| דשבורדים | /dashboards | WORKS |
| מפת דרכים | /roadmap | PARTIAL |
| מטריצת משימות | /taskmatrix | WORKS |
| יצירת נתוני דמו | /seeddata | NO PAGE EXISTS |
| מנהל נתוני בדיקה | /testdatamanager | WORKS |

### Navigation Issues
- 4 menu items link to pages that don't exist: ClientContracts, Quotes, NewClientContracts, PriceWiseIntegration
- "יצירת נתוני דמו" links to /seeddata which has no route (should be TestDataManager)
- "מעקב מאזנים שנתיים" has href="#" - broken

---

## Critical Issues Summary

### HIGH Priority
1. **Treatment remnants in Home.jsx** - Links to TreatmentInput, therapy language
2. **4 nav items link to nonexistent pages** - ClientContracts, Quotes, NewClientContracts, PriceWiseIntegration
3. **createMonthlyBoards is a stub** - Button exists in MondayIntegration but function returns error
4. **No cloud backup** - localStorage only, one clear-cache away from data loss
5. **No `$ne` operator in localDB** - BusinessHub filters silently fail

### MEDIUM Priority
6. **Tasks.jsx debug code** - Lines 159-197 load ALL tasks/clients/reconciliations for console.log on every render
7. **Dead therapy pages** - TreatmentInput, WeeklyPlanning pages + TreatmentInput component (36K)
8. **Therapy references scattered** - MondayIntegration, Recommendations, SystemOverview, Home
9. **generateProcessTasks stub** - BusinessHub buttons don't work
10. **WeeklySummary loads ALL tasks** - No board filter, may show irrelevant data

### LOW Priority
11. **ServiceProvidersPage duplicate** - Two similar service provider pages
12. **Excel import/export stubs** - Not implemented
13. **MoodTracker/SmartNudge unused** - Components exist but not mounted
14. **WeeklyPlanner state not persisted** - DnD schedule lost on refresh
15. **SeedData nav link broken** - Links to nonexistent route

---

## Dead Code to Remove

### Pages to Remove (3)
```
src/pages/TreatmentInput.jsx (763B) - therapy wrapper
src/pages/WeeklyPlanning.jsx (763B) - therapy wrapper duplicate
```

### Components to Remove (1)
```
src/components/scheduling/TreatmentInput.jsx (36K) - entire therapy scheduling system
```

### Routes to Remove from index.jsx
```
/TreatmentInput
/WeeklyPlanning
```

### Entity Cleanup
- `Therapist` entity referenced in: entities.js, localDB.js, functions.js, MondayIntegration.jsx, SystemOverview.jsx, TestDataManager.jsx
- `WeeklySchedule` entity referenced in: entities.js, localDB.js, MondayIntegration.jsx

### Functions to Remove
```
getWeeklyPlan (only used by dead TreatmentInput)
createWeeklyPlan (only used by dead TreatmentInput)
syncTherapistsFromBoard (in functions.js - therapy sync)
```

---

## Independence Plan (CalmPlan Standalone)

### Current Monday.com Dependencies
1. **Data source** - All tasks synced from Monday boards
2. **Board configs** - Dashboard entity maps board types to Monday board IDs
3. **Status management** - Hebrew status mapping between systems
4. **Client management** - Bidirectional sync

### Steps to Full Independence
1. **Add native task creation** - Currently Tasks.jsx only shows Monday-synced tasks. Add ability to create tasks directly in CalmPlan.
2. **Remove board ID requirement** - Home/Tasks/Calendar all require Dashboard board configs. Add fallback for when no Monday boards are configured.
3. **Cloud persistence** - Replace localStorage with cloud storage (Google Drive API, Supabase, or Firebase)
4. **Native scheduling** - Replace Monday.com boards with native recurrence engine
5. **Keep Monday.com as optional plugin** - Don't remove sync, just make it optional

### Recommended Cloud Backup Architecture
| Option | Pros | Cons |
|--------|------|------|
| **Google Drive (recommended)** | Free 15GB, API available, future Gmail/Calendar integration | Google account required |
| Dropbox | Simple API | No email/calendar integration, less free storage |
| Supabase | Real database, auth built-in | Requires hosting, more complex |
| Firebase | Real-time, auth, hosting | Google lock-in, pricing at scale |

**Recommendation:** Google Drive for backup NOW (simple JSON export/import to Drive). Later, Google Calendar + Gmail integration for automations.

---

## Recommended Action Plan

### Phase 1: Cleanup (This Session)
1. Remove dead therapy pages + component
2. Remove dead routes from index.jsx
3. Fix Home.jsx link (TreatmentInput -> WeeklyPlanner)
4. Remove debug console.log from Tasks.jsx
5. Fix broken nav items (remove or correct links)
6. Add `$ne` operator to localDB.js

### Phase 2: Core Fixes
7. Implement `createMonthlyBoards` function
8. Clean therapy references from MondayIntegration, Recommendations, SystemOverview
9. Add board-filtered loading to WeeklySummary
10. Fix BusinessHub stub buttons

### Phase 3: Independence
11. Add native task creation (not dependent on Monday sync)
12. Implement Google Drive backup
13. Build recurrence engine for tasks
14. Make Monday.com integration optional

---

*Generated by comprehensive codebase audit, February 2026*
