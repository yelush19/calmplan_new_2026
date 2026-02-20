// backend/services/SchedulingEngine.js
// מנוע תכנון חכם למערכת CalmPlan

class SchedulingEngine {
  constructor() {
    this.workingHours = {
      start: '08:00',
      end: '20:00',
      lunchBreak: { start: '12:30', end: '13:30' }
    };
    
    this.energyPatterns = {
      morning: { '08:00-10:00': 'high', '10:00-12:00': 'medium' },
      afternoon: { '13:30-15:00': 'low', '15:00-17:00': 'medium' },
      evening: { '17:00-20:00': 'low' }
    };
    
    this.taskPriorities = {
      salary: 100,
      vat: 90,
      reconciliation: 80,
      reporting: 70,
      client_work: 60,
      household: 40,
      personal: 30
    };
  }

  /**
   * יוצר תכנון שבועי אופטימלי
   * @param {Object} weeklySchedule - לוח הטיפולים מ-TreatmentInput
   * @param {Array} tasks - רשימת משימות לשיבוץ
   * @param {Object} preferences - העדפות משתמש
   * @returns {Object} תכנון שבועי מלא
   */
  async generateOptimalSchedule(weeklySchedule, tasks, preferences = {}) {
    try {
      // 1. חלץ את הטיפולים והזמנים החסומים
      const blockedTimes = this.extractBlockedTimes(weeklySchedule);
      
      // 2. מיין משימות לפי עדיפות ודחיפות
      const prioritizedTasks = this.prioritizeTasks(tasks);
      
      // 3. מצא חלונות זמן פנויים
      const availableSlots = this.findAvailableSlots(blockedTimes);
      
      // 4. התאם משימות לחלונות זמן
      const scheduledTasks = this.matchTasksToSlots(prioritizedTasks, availableSlots, preferences);
      
      // 5. חלק משימות בית למשפחה
      const familyTasks = this.distributeFamilyTasks(scheduledTasks.household);
      
      // 6. בדוק ואופטימיזציה
      const optimizedSchedule = this.optimizeSchedule(scheduledTasks, familyTasks);
      
      return {
        success: true,
        schedule: optimizedSchedule,
        summary: this.generateSummary(optimizedSchedule),
        warnings: this.checkScheduleWarnings(optimizedSchedule)
      };
      
    } catch (error) {
      console.error('SchedulingEngine error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * חילוץ זמנים חסומים מלוח הטיפולים
   */
  extractBlockedTimes(weeklySchedule) {
    const blocked = {};
    
    weeklySchedule.treatments?.forEach(treatment => {
      const day = treatment.day;
      if (!blocked[day]) blocked[day] = [];
      
      // הטיפול עצמו
      blocked[day].push({
        start: treatment.startTime,
        end: treatment.endTime,
        type: 'treatment',
        location: 'hospital'
      });
      
      // זמן נסיעה לפני
      blocked[day].push({
        start: this.subtractTime(treatment.startTime, 60),
        end: treatment.startTime,
        type: 'commute',
        location: 'transit'
      });
      
      // זמן נסיעה אחרי
      blocked[day].push({
        start: treatment.endTime,
        end: this.addTime(treatment.endTime, 60),
        type: 'commute',
        location: 'transit'
      });
    });
    
    return blocked;
  }

  /**
   * מיון משימות לפי עדיפות ודחיפות
   */
  prioritizeTasks(tasks) {
    return tasks.map(task => {
      const score = this.calculateTaskScore(task);
      return { ...task, priorityScore: score };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  calculateTaskScore(task) {
    let score = 0;
    
    // עדיפות לפי סוג
    const category = task.category || 'personal';
    score += this.taskPriorities[category] || 0;
    
    // דחיפות לפי דדליין
    if (task.deadline) {
      const daysUntilDeadline = this.daysBetween(new Date(), new Date(task.deadline));
      if (daysUntilDeadline <= 1) score += 200;
      else if (daysUntilDeadline <= 3) score += 100;
      else if (daysUntilDeadline <= 7) score += 50;
      
      // חישוב באפר
      const bufferDays = task.bufferDays || 2;
      if (daysUntilDeadline <= bufferDays) score += 150;
    }
    
    // התחשבות במשך המשימה
    if (task.estimatedDuration > 120) score += 30; // משימות ארוכות דורשות תכנון מוקדם
    
    // התאמה לרמת אנרגיה
    if (task.energyLevel === 'high') score += 20;
    
    return score;
  }

  /**
   * מציאת חלונות זמן פנויים
   */
  findAvailableSlots(blockedTimes) {
    const slots = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    
    days.forEach(day => {
      slots[day] = [];
      const dayBlocked = blockedTimes[day] || [];
      
      // התחל מתחילת יום העבודה
      let currentTime = this.workingHours.start;
      
      while (currentTime < this.workingHours.end) {
        // בדוק אם הזמן הנוכחי פנוי
        const isBlocked = dayBlocked.some(block => 
          this.timeOverlaps(currentTime, this.addTime(currentTime, 30), block.start, block.end)
        );
        
        // בדוק הפסקת צהריים
        const isLunchTime = this.timeOverlaps(
          currentTime, 
          this.addTime(currentTime, 30),
          this.workingHours.lunchBreak.start,
          this.workingHours.lunchBreak.end
        );
        
        if (!isBlocked && !isLunchTime) {
          // מצא את סוף החלון הפנוי
          let endTime = this.addTime(currentTime, 30);
          let slotEnd = endTime;
          
          while (slotEnd < this.workingHours.end) {
            const nextBlocked = dayBlocked.some(block => 
              this.timeOverlaps(slotEnd, this.addTime(slotEnd, 30), block.start, block.end)
            );
            
            if (nextBlocked || slotEnd === this.workingHours.lunchBreak.start) break;
            
            slotEnd = this.addTime(slotEnd, 30);
          }
          
          // הוסף את החלון הפנוי
          slots[day].push({
            start: currentTime,
            end: slotEnd,
            duration: this.timeDiff(currentTime, slotEnd),
            energyLevel: this.getEnergyLevel(currentTime),
            location: this.determineLocation(day, currentTime, dayBlocked)
          });
          
          currentTime = slotEnd;
        } else {
          currentTime = this.addTime(currentTime, 30);
        }
      }
    });
    
    return slots;
  }

  /**
   * התאמת משימות לחלונות זמן
   */
  matchTasksToSlots(tasks, availableSlots, preferences) {
    const scheduled = {
      work: [],
      household: [],
      personal: [],
      unscheduled: []
    };
    
    const remainingSlots = JSON.parse(JSON.stringify(availableSlots)); // Deep copy
    
    tasks.forEach(task => {
      const bestSlot = this.findBestSlotForTask(task, remainingSlots, preferences);
      
      if (bestSlot) {
        const scheduledTask = {
          ...task,
          day: bestSlot.day,
          startTime: bestSlot.startTime,
          endTime: this.addTime(bestSlot.startTime, task.estimatedDuration || 30),
          location: bestSlot.location,
          matchScore: bestSlot.score
        };
        
        // הוסף לקטגוריה המתאימה
        const category = task.context === 'home' ? 'household' : 
                        task.category === 'personal' ? 'personal' : 'work';
        scheduled[category].push(scheduledTask);
        
        // עדכן את החלונות הפנויים
        this.updateRemainingSlots(remainingSlots, bestSlot, task);
      } else {
        scheduled.unscheduled.push(task);
      }
    });
    
    return scheduled;
  }

  /**
   * מציאת החלון הטוב ביותר למשימה
   */
  findBestSlotForTask(task, availableSlots, preferences) {
    let bestSlot = null;
    let bestScore = -1;
    
    Object.entries(availableSlots).forEach(([day, slots]) => {
      slots.forEach(slot => {
        // בדוק אם המשימה מתאימה לחלון
        if (slot.duration < (task.estimatedDuration || 30)) return;
        
        const score = this.calculateSlotScore(task, slot, day, preferences);
        
        if (score > bestScore) {
          bestScore = score;
          bestSlot = {
            day,
            startTime: slot.start,
            location: slot.location,
            energyLevel: slot.energyLevel,
            score
          };
        }
      });
    });
    
    return bestSlot;
  }

  /**
   * חישוב ציון התאמה של משימה לחלון זמן
   */
  calculateSlotScore(task, slot, day, preferences) {
    let score = 0;
    
    // התאמת אנרגיה
    if (task.energyLevel === slot.energyLevel) score += 30;
    else if (task.energyLevel === 'high' && slot.energyLevel === 'medium') score += 20;
    else if (task.energyLevel === 'low' && slot.energyLevel !== 'low') score += 10;
    
    // התאמת מיקום
    if (task.locationFlexibility === 'anywhere') score += 20;
    else if (task.locationFlexibility === 'remote_possible' && slot.location !== 'office') score += 25;
    else if (task.locationFlexibility === 'office_only' && slot.location === 'office') score += 30;
    
    // העדפת זמן
    if (task.preferredTimeOfDay) {
      const hour = parseInt(slot.start.split(':')[0]);
      if (task.preferredTimeOfDay === 'morning' && hour < 12) score += 20;
      else if (task.preferredTimeOfDay === 'afternoon' && hour >= 12 && hour < 17) score += 20;
      else if (task.preferredTimeOfDay === 'evening' && hour >= 17) score += 20;
    }
    
    // קרבה לדדליין
    if (task.deadline) {
      const daysUntilDeadline = this.daysBetween(new Date(), new Date(task.deadline));
      const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].indexOf(day);
      if (dayIndex < daysUntilDeadline) score += 10;
    }
    
    // העדפות משתמש
    if (preferences[task.category]?.[day]) score += 15;
    
    return score;
  }

  /**
   * חלוקת משימות בית למשפחה
   */
  distributeFamilyTasks(householdTasks) {
    const familyMembers = {
      parent: { maxTasks: 15, capabilities: ['all'] },
      teen16: { maxTasks: 7, capabilities: ['driving', 'cooking_simple', 'cleaning', 'garden'] },
      teen14: { maxTasks: 5, capabilities: ['cleaning', 'dishes', 'laundry', 'garden_simple'] }
    };
    
    const distribution = {
      parent: [],
      teen16: [],
      teen14: []
    };
    
    householdTasks.forEach(task => {
      // מצא את המתאים ביותר
      let assigned = false;
      
      task.suitableFor?.forEach(member => {
        if (!assigned && distribution[member].length < familyMembers[member].maxTasks) {
          distribution[member].push(task);
          assigned = true;
        }
      });
      
      // אם לא שובץ, תן להורה
      if (!assigned) {
        distribution.parent.push(task);
      }
    });
    
    return distribution;
  }

  /**
   * אופטימיזציה של הלוח
   */
  optimizeSchedule(scheduled, familyTasks) {
    const optimized = {
      ...scheduled,
      familyTasks,
      metadata: {
        totalTasks: 0,
        totalHours: 0,
        workloadBalance: {}
      }
    };
    
    // חשב סטטיסטיקות
    Object.values(scheduled).forEach(categoryTasks => {
      if (Array.isArray(categoryTasks)) {
        optimized.metadata.totalTasks += categoryTasks.length;
        optimized.metadata.totalHours += categoryTasks.reduce((sum, task) => 
          sum + (task.estimatedDuration || 30) / 60, 0
        );
      }
    });
    
    // בדוק איזון עומסים יומי
    const dailyLoad = {};
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].forEach(day => {
      dailyLoad[day] = this.calculateDailyLoad(scheduled, day);
      optimized.metadata.workloadBalance[day] = dailyLoad[day];
    });
    
    return optimized;
  }

  /**
   * יצירת סיכום לתכנון
   */
  generateSummary(schedule) {
    return {
      totalTasks: schedule.metadata.totalTasks,
      totalHours: Math.round(schedule.metadata.totalHours * 10) / 10,
      unscheduledTasks: schedule.unscheduled.length,
      familyParticipation: {
        teen16: schedule.familyTasks.teen16.length,
        teen14: schedule.familyTasks.teen14.length
      },
      busyDays: Object.entries(schedule.metadata.workloadBalance)
        .filter(([_, hours]) => hours > 8)
        .map(([day]) => day)
    };
  }

  /**
   * בדיקת אזהרות בתכנון
   */
  checkScheduleWarnings(schedule) {
    const warnings = [];
    
    // בדוק עומס יתר
    Object.entries(schedule.metadata.workloadBalance).forEach(([day, hours]) => {
      if (hours > 10) {
        warnings.push({
          type: 'overload',
          day,
          message: `יום ${day} עמוס מדי (${hours} שעות)`
        });
      }
    });
    
    // בדוק משימות שלא שובצו
    if (schedule.unscheduled.length > 0) {
      warnings.push({
        type: 'unscheduled',
        count: schedule.unscheduled.length,
        message: `${schedule.unscheduled.length} משימות לא שובצו`,
        tasks: schedule.unscheduled.map(t => t.name)
      });
    }
    
    // בדוק דדליינים בסכנה
    schedule.unscheduled.forEach(task => {
      if (task.deadline) {
        const daysLeft = this.daysBetween(new Date(), new Date(task.deadline));
        if (daysLeft <= 2) {
          warnings.push({
            type: 'deadline_risk',
            task: task.name,
            message: `משימה "${task.name}" בסכנת פספוס דדליין`
          });
        }
      }
    });
    
    return warnings;
  }

  // === Helper Functions ===
  
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  
  addTime(time, minutes) {
    return this.minutesToTime(this.timeToMinutes(time) + minutes);
  }
  
  subtractTime(time, minutes) {
    return this.minutesToTime(Math.max(0, this.timeToMinutes(time) - minutes));
  }
  
  timeDiff(start, end) {
    return this.timeToMinutes(end) - this.timeToMinutes(start);
  }
  
  timeOverlaps(start1, end1, start2, end2) {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);
    
    return s1 < e2 && e1 > s2;
  }
  
  daysBetween(date1, date2) {
    const diffTime = Math.abs(date2 - date1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  
  getEnergyLevel(time) {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 8 && hour < 10) return 'high';
    if (hour >= 10 && hour < 12) return 'medium';
    if (hour >= 13 && hour < 15) return 'low';
    if (hour >= 15 && hour < 17) return 'medium';
    return 'low';
  }
  
  determineLocation(day, time, blockedTimes) {
    // בדוק אם אחרי/לפני נסיעה לבית חולים
    const nearTransit = blockedTimes.some(block => 
      block.type === 'commute' && 
      Math.abs(this.timeToMinutes(time) - this.timeToMinutes(block.end)) < 60
    );
    
    if (nearTransit) return 'office'; // המשרד ליד בית החולים
    return 'home'; // ברירת מחדל
  }
  
  calculateDailyLoad(scheduled, day) {
    let totalMinutes = 0;
    
    Object.values(scheduled).forEach(categoryTasks => {
      if (Array.isArray(categoryTasks)) {
        categoryTasks.forEach(task => {
          if (task.day === day) {
            totalMinutes += task.estimatedDuration || 30;
          }
        });
      }
    });
    
    return Math.round(totalMinutes / 60 * 10) / 10;
  }
  
  updateRemainingSlots(slots, usedSlot, task) {
    const daySlots = slots[usedSlot.day];
    const taskDuration = task.estimatedDuration || 30;
    
    for (let i = 0; i < daySlots.length; i++) {
      const slot = daySlots[i];
      
      if (slot.start === usedSlot.startTime) {
        // עדכן את החלון
        const newStart = this.addTime(slot.start, taskDuration);
        
        if (this.timeToMinutes(newStart) < this.timeToMinutes(slot.end)) {
          // עדכן את תחילת החלון
          slot.start = newStart;
          slot.duration = this.timeDiff(newStart, slot.end);
        } else {
          // הסר את החלון לגמרי
          daySlots.splice(i, 1);
        }
        break;
      }
    }
  }
}

// Export the engine
module.exports = SchedulingEngine;