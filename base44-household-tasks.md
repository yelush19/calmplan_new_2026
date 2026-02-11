# הנחיות ל-BASE44: הוספת משימות ביתיות ל-CalmPlan

## 🏠 סקירה כללית

מסמך זה מכיל הנחיות להוספת מודול משימות ביתיות למערכת CalmPlan. המודול צריך לתמוך בניהול משימות בית, גינה, וטיפול בבן הזוג, עם חלוקה חכמה בין בני המשפחה.

---

## 📋 רשימת המשימות להוספה במערכת

### 1. משימות יומיות

```javascript
const dailyTasks = [
  {
    name: "הכנת ארוחת בוקר",
    category: "kitchen",
    estimatedDuration: 30,
    cognitiveLoad: "low",
    energyLevel: "medium",
    suitableFor: ["parent"],
    icon: "🍳",
    recurring: "daily",
    preferredTime: "morning"
  },
  {
    name: "הכנת צהריים",
    category: "kitchen",
    estimatedDuration: 45,
    cognitiveLoad: "medium",
    energyLevel: "medium",
    suitableFor: ["teen16", "teen14"],
    icon: "🥗",
    recurring: "daily",
    preferredTime: "afternoon",
    rotationType: "weekly" // מתחלף בין הילדים
  },
  {
    name: "הכנת ארוחת ערב",
    category: "kitchen",
    estimatedDuration: 60,
    cognitiveLoad: "medium",
    energyLevel: "medium",
    suitableFor: ["parent", "teen16"],
    icon: "🍽️",
    recurring: "daily",
    preferredTime: "evening",
    collaborative: true
  },
  {
    name: "ניקיון אחרי ארוחות",
    category: "cleaning",
    estimatedDuration: 20,
    cognitiveLoad: "low",
    energyLevel: "low",
    suitableFor: ["teen16", "teen14"],
    icon: "🧽",
    recurring: "daily",
    timesPerDay: 3,
    rotationType: "daily"
  },
  {
    name: "סידור חללים משותפים",
    category: "cleaning",
    estimatedDuration: 15,
    cognitiveLoad: "low",
    energyLevel: "low",
    suitableFor: ["parent", "teen16", "teen14"],
    icon: "🏠",
    recurring: "daily",
    rotationType: "daily"
  }
];
```

### 2. משימות שבועיות

```javascript
const weeklyTasks = [
  {
    name: "ניקיון עמוק חדרי אמבטיה",
    category: "cleaning",
    estimatedDuration: 60,
    cognitiveLoad: "low",
    energyLevel: "high",
    suitableFor: ["parent"],
    icon: "🚿",
    recurring: "weekly",
    preferredDay: "Saturday"
  },
  {
    name: "שאיבת אבק וניגוב רצפות",
    category: "cleaning",
    estimatedDuration: 90,
    cognitiveLoad: "low",
    energyLevel: "high",
    suitableFor: ["teen16", "teen14"],
    icon: "🧹",
    recurring: "weekly",
    preferredDay: "Sunday"
  },
  {
    name: "כביסה - הפעלה וקיפול",
    category: "laundry",
    estimatedDuration: 120,
    cognitiveLoad: "low",
    energyLevel: "medium",
    suitableFor: ["parent", "teen16", "teen14"],
    icon: "👕",
    recurring: "weekly",
    splitPossible: true,
    note: "כל אחד אחראי לכביסה שלו"
  },
  {
    name: "קניות מזון שבועיות",
    category: "shopping",
    estimatedDuration: 120,
    cognitiveLoad: "medium",
    energyLevel: "medium",
    suitableFor: ["parent"],
    locationFlexibility: "office_only",
    icon: "🛒",
    recurring: "weekly",
    preferredDay: "Saturday"
  }
];
```

### 3. משימות גינה

```javascript
const gardenTasks = [
  {
    name: "ניקוי עשבים - אזור ורדים (עליון)",
    category: "garden",
    estimatedDuration: 45,
    cognitiveLoad: "low",
    energyLevel: "medium",
    suitableFor: ["parent", "teen16", "teen14"],
    icon: "🌹",
    recurring: "biweekly",
    requiresSupervision: true,
    safety: "נדרשות כפפות - קוצים",
    area: "upper_roses"
  },
  {
    name: "ניקוי עשבים - אזור עץ מנגו",
    category: "garden",
    estimatedDuration: 30,
    cognitiveLoad: "low",
    energyLevel: "medium",
    suitableFor: ["parent"],
    icon: "🥭",
    recurring: "triweekly",
    area: "lower_mango"
  },
  {
    name: "ניקוי עשבים - אזור עצי הדר",
    category: "garden",
    estimatedDuration: 40,
    cognitiveLoad: "low",
    energyLevel: "medium",
    suitableFor: ["parent"],
    icon: "🍊",
    recurring: "triweekly",
    area: "lower_citrus"
  },
  {
    name: "בדיקת מערכת השקיה",
    category: "garden",
    estimatedDuration: 15,
    cognitiveLoad: "medium",
    energyLevel: "low",
    suitableFor: ["parent"],
    icon: "💧",
    recurring: "weekly",
    systemType: "galcon"
  },
  {
    name: "מילוי מיכל דישון",
    category: "garden",
    estimatedDuration: 30,
    cognitiveLoad: "medium",
    energyLevel: "low",
    suitableFor: ["parent"],
    icon: "🧪",
    recurring: "monthly",
    instructions: "20-30% מנפח המיכל + דשן לפי הוראות"
  }
];
```

### 4. משימות טיפול בבן הזוג

```javascript
const caregivingTasks = [
  {
    name: "ליווי לטיפולים",
    category: "caregiving",
    estimatedDuration: 300, // 5 שעות כולל נסיעה
    cognitiveLoad: "medium",
    energyLevel: "medium",
    suitableFor: ["parent", "teen16"],
    icon: "🏥",
    recurring: "custom",
    locationFlexibility: "office_only",
    priority: "critical",
    includesCommute: true
  },
  {
    name: "הכנת ארוחות מיוחדות",
    category: "caregiving",
    estimatedDuration: 45,
    cognitiveLoad: "medium",
    energyLevel: "medium",
    suitableFor: ["parent"],
    icon: "🥣",
    recurring: "daily",
    adaptable: true
  },
  {
    name: "ניהול תרופות",
    category: "caregiving",
    estimatedDuration: 15,
    cognitiveLoad: "high",
    energyLevel: "low",
    suitableFor: ["parent"],
    icon: "💊",
    recurring: "daily",
    priority: "critical",
    requiresAlerts: true
  },
  {
    name: "זמן איכות ותמיכה רגשית",
    category: "caregiving",
    estimatedDuration: 30,
    cognitiveLoad: "low",
    energyLevel: "low",
    suitableFor: ["parent", "teen16", "teen14"],
    icon: "💝",
    recurring: "daily",
    flexible: true
  }
];
```

---

## 🎨 עיצוב ממשק המשתמש

### 1. דף ניהול משימות ביתיות

```jsx
// דוגמת מבנה לקומפוננטה
<HouseholdTasksPage>
  <Header>
    <Title>משימות הבית והמשפחה</Title>
    <QuickStats>
      <Stat icon="✅" value={completedToday} label="הושלמו היום" />
      <Stat icon="⏳" value={pendingToday} label="ממתינות" />
      <Stat icon="👨‍👩‍👧‍👦" value={familyTasks} label="משימות משפחה" />
    </QuickStats>
  </Header>
  
  <TaskCategories>
    <CategoryTab icon="🏠" label="בית" count={houseTasks.length} />
    <CategoryTab icon="🌿" label="גינה" count={gardenTasks.length} />
    <CategoryTab icon="💝" label="טיפול" count={careTasks.length} />
    <CategoryTab icon="📅" label="חודשיות" count={monthlyTasks.length} />
  </TaskCategories>
  
  <TasksList>
    {/* רשימת משימות מסודרת לפי קטגוריה */}
  </TasksList>
  
  <FamilyAssignments>
    {/* תצוגת חלוקת משימות בין בני המשפחה */}
  </FamilyAssignments>
</HouseholdTasksPage>
```

### 2. כרטיס משימה ביתית

```jsx
<HouseholdTaskCard>
  <TaskHeader>
    <Icon>{task.icon}</Icon>
    <TaskName>{task.name}</TaskName>
    <RecurringBadge>{task.recurring}</RecurringBadge>
  </TaskHeader>
  
  <TaskDetails>
    <Duration>⏱️ {task.estimatedDuration} דקות</Duration>
    <Energy>⚡ {task.energyLevel}</Energy>
    <Cognitive>🧠 {task.cognitiveLoad}</Cognitive>
  </TaskDetails>
  
  <AssignmentSection>
    <SuitableFor>
      {task.suitableFor.map(person => (
        <PersonChip>{person}</PersonChip>
      ))}
    </SuitableFor>
    <AssignButton onClick={() => assignTask(task)}>
      הקצה למישהו
    </AssignButton>
  </AssignmentSection>
  
  {task.safety && (
    <SafetyWarning>
      ⚠️ {task.safety}
    </SafetyWarning>
  )}
</HouseholdTaskCard>
```

### 3. לוח מחוונים משפחתי

```jsx
<FamilyDashboard>
  <MemberCard foreach={familyMember}>
    <Avatar>{member.name[0]}</Avatar>
    <MemberStats>
      <TodayTasks>{member.todayTasks}/{member.maxTasks}</TodayTasks>
      <WeeklyHours>{member.weeklyHours} שעות השבוע</WeeklyHours>
    </MemberStats>
    <TaskProgress>
      <ProgressBar value={member.completionRate} />
    </TaskProgress>
  </MemberCard>
</FamilyDashboard>
```

---

## 🔧 הגדרות ותצורה

### 1. הגדרות משימות חוזרות

```javascript
const recurringSettings = {
  daily: { interval: 1, unit: 'day' },
  weekly: { interval: 7, unit: 'day' },
  biweekly: { interval: 14, unit: 'day' },
  triweekly: { interval: 21, unit: 'day' },
  monthly: { interval: 1, unit: 'month' },
  custom: { /* יוגדר ידנית */ }
};
```

### 2. כללי חלוקת משימות

```javascript
const assignmentRules = {
  maxTasksPerDay: {
    teen14: 5,
    teen16: 7,
    parent: 15
  },
  restDays: {
    teen14: ['Sunday'],
    teen16: ['Sunday'],
    parent: []
  },
  schoolHours: {
    teen14: { start: '08:00', end: '14:00' },
    teen16: { start: '08:00', end: '15:00' }
  }
};
```

### 3. התראות מיוחדות

```javascript
const specialAlerts = {
  medication: {
    type: 'critical',
    sound: true,
    vibrate: true,
    snooze: 5 // דקות
  },
  gardenFertilizer: {
    type: 'reminder',
    advanceDays: 2,
    message: 'בעוד יומיים צריך למלא דישון'
  },
  treatmentPrep: {
    type: 'preparation',
    minutesBefore: 60,
    message: 'להתכונן לנסיעה לטיפול'
  }
};
```

---

## 📊 אינטגרציה עם התכנון השבועי

### חיבור למנוע התכנון

```javascript
// הוספת משימות ביתיות לתכנון השבועי
const integrateHouseholdTasks = (weeklySchedule, householdTasks) => {
  householdTasks.forEach(task => {
    if (task.recurring) {
      const nextOccurrence = calculateNextOccurrence(task);
      const bestTimeSlot = findOptimalTimeSlot(task, weeklySchedule);
      
      if (bestTimeSlot) {
        weeklySchedule.addTask({
          ...task,
          scheduledTime: bestTimeSlot,
          assignedTo: selectBestFamilyMember(task)
        });
      }
    }
  });
  
  return weeklySchedule;
};
```

---

## ✅ Checklist ליישום

- [ ] יצירת טבלת משימות ביתיות ב-DB
- [ ] בניית ממשק להוספה/עריכת משימות
- [ ] מנגנון חלוקה אוטומטית בין בני משפחה
- [ ] התראות למשימות קריטיות
- [ ] תצוגת לוח משימות משפחתי
- [ ] אינטגרציה עם התכנון השבועי
- [ ] דוחות ביצוע וסטטיסטיקות
- [ ] תמיכה במשימות גינה מיוחדות
- [ ] מעקב אחר משימות טיפול בבן הזוג

---

**הערות חשובות:**
1. כל המשימות צריכות להיות גמישות ולאפשר דחייה במקרה הצורך
2. משימות טיפול בבן הזוג תמיד בעדיפות עליונה
3. יש להתחשב בזמני בית ספר של הילדים
4. מומלץ להוסיף gamification עדין לעידוד השתתפות

**בהצלחה!** 🚀