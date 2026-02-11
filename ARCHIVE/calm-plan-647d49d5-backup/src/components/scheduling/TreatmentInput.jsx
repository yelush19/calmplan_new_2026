
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Fixed syntax error: removed 's'
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle, XCircle, Clock, Brain, Save,
  ArrowLeft, Calendar, User, CheckCircle, Import,
  ChevronLeft, ChevronRight, Cloud, RotateCcw, AlertCircle as AlertCircleIcon
} from 'lucide-react';
import { WeeklySchedule, Task, Dashboard } from '@/api/entities'; // Added Dashboard
import { format, addDays, startOfWeek, parse, getDay, isValid } from 'date-fns';
import { he } from 'date-fns/locale';
import { createWeeklyPlan } from '@/api/functions';
import { mondayBoardApi } from '@/api/functions';
import { Therapist } from '@/api/entities'; // Added Therapist entity import

const daysOfWeek = [
  { key: 'sunday', name: 'יום ראשון', dayIndex: 0 },
  { key: 'monday', name: 'יום שני', dayIndex: 1 },
  { key: 'tuesday', name: 'יום שלישי', dayIndex: 2 },
  { key: 'wednesday', name: 'יום רביעי', dayIndex: 3 },
  { key: 'thursday', name: 'יום חמישי', dayIndex: 4 },
];

const treatmentTypes = [
  'פיזיותרפיה',
  'ריפוי בעיסוק',
  'קלינאית תקשורת',
  'פסיכולוג',
  'רופא',
  'הידרותרפיה',
  'דיקור סיני',
  'עו"ס/אחות',
  'אחר'
];

const locationOptions = [
  'משרד',
  'בית',
  'משרד ביתי',
  'ביה"ח שיבא',
  'אחר'
];

const treatmentRoomOptions = [
  'בריכה',
  'ח.בדיקות-לבדוק איזה',
  'פיזיו',
  'ריפוי בעיסוק'
];

const statusOptions = [
  { value: 'planned', label: 'מתוכנן', color: 'bg-orange-100 text-orange-800' },
  { value: 'completed', label: 'הושלם', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'בוטל', color: 'bg-red-100 text-red-800' }
];

const cognitiveLoadOptions = [
  { value: 'low', label: 'נמוך', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'בינוני', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'גבוה', color: 'bg-red-100 text-red-800' }
];

const patientOptions = [
  'יאיר',
  'לנה',
  'לינוי',
  'איתי',
  'אחר'
];

const WORK_HOURS_PER_DAY = 8;
const TRAVEL_HOURS_PER_TREATMENT_DAY = 2;

const calculateDuration = (start, end) => {
  if (!start || !end) return 0;
  const startTime = parse(start, 'HH:mm', new Date());
  const endTime = parse(end, 'HH:mm', new Date());
  return endTime > startTime ? (endTime - startTime) / (1000 * 60) : 0;
};

export default function TreatmentInput({ onPlanCreated, onCancel }) {
  const [treatments, setTreatments] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('sunday');
  const [conflicts, setConflicts] = useState({});
  const [summary, setSummary] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saved', 'saving', 'error', null (initial)
  const [lastSaved, setLastSaved] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  // FIX: Always start on Sunday of current week, not next week
  const [weekStartDate, setWeekStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [allTherapists, setAllTherapists] = useState([]); // New state for all therapists
  const [mondayTreatments, setMondayTreatments] = useState([]); // New state for Monday synced treatments

  // Fetch therapists on component mount
  useEffect(() => {
    const loadTherapists = async () => {
      try {
        const therapists = await Therapist.filter({ status: 'active' }); // Filter for active therapists
        setAllTherapists(therapists || []);
      } catch (error) {
        console.error("Failed to load therapists:", error);
      }
    };
    loadTherapists();
  }, []);

  // Load Monday synced treatments for the selected week
  useEffect(() => {
    const loadMondayTreatments = async () => {
      try {
        console.log('🔍 DEBUG: Starting to load Monday treatments...');
        
        const dashboards = await Dashboard.list();
        console.log('🔍 DEBUG: Found dashboards:', dashboards);
        
        const treatmentsBoardConfig = dashboards.find(d => d.type === 'weekly_planning');
        console.log('🔍 DEBUG: Treatment board config:', treatmentsBoardConfig);
        
        if (!treatmentsBoardConfig || !treatmentsBoardConfig.monday_board_id) {
            console.warn("⚠️  Treatments board not configured in Monday Integration settings. Skipping Monday treatment import.");
            setMondayTreatments([]);
            setTreatments(prev => prev.filter(t => !t.isFromMonday)); // Clear old monday treatments
            return;
        }
        
        const treatmentsBoardId = treatmentsBoardConfig.monday_board_id;
        console.log(`🔍 DEBUG: Looking for treatments from board ID: ${treatmentsBoardId}`);

        // First check if the board is synced to Task table
        const mondayTasks = await Task.filter({
          'monday_board_id': treatmentsBoardId,
        });

        console.log(`🔍 DEBUG: Found ${mondayTasks.length} treatments from board ${treatmentsBoardId}`);
        
        if (mondayTasks.length === 0) {
          console.warn(`⚠️  No treatments found for board ${treatmentsBoardId}. Make sure the board is synced in Monday Integration.`);
          setMondayTreatments([]);
          setTreatments(prev => prev.filter(t => !t.isFromMonday));
          return;
        }

        console.log('🔍 DEBUG: Sample Monday task:', mondayTasks[0]);

        // Helper to get column value by title
        const getColumnValue = (task, columnTitle, parseJson = true) => {
            const column = (task.column_values || []).find(cv => cv.title === columnTitle);
            if (!column || column.value === null || column.value === undefined) return null;
            try {
                const parsed = parseJson ? JSON.parse(column.value) : column.value;
                if (typeof parsed === 'string' && parsed.trim() === '') return null;
                return parsed;
            } catch (e) {
                return column.value;
            }
        };

        // Convert Monday tasks to treatment format - PROPERLY extract data
        const convertedTreatments = (mondayTasks || []).map(task => {
          let treatmentDate = new Date(weekStartDate); // Default to start of week
          let startTime = '09:00';
          let endTime = '10:00';
          
          // Extract data from Monday columns
          const mondayDateData = getColumnValue(task, 'תאריך', true);
          const mondayStartTime = getColumnValue(task, 'שעת התחלה', false);
          const mondayEndTime = getColumnValue(task, 'שעת סיום', false);
          
          if (mondayDateData && mondayDateData.date) {
            const parsedDate = parse(mondayDateData.date, 'yyyy-MM-dd', new Date());
            if (isValid(parsedDate)) {
              treatmentDate = parsedDate;
            }
          }

          if (mondayStartTime) startTime = mondayStartTime;
          if (mondayEndTime) endTime = mondayEndTime;
          
          const statusRaw = getColumnValue(task, 'סטטוס', true);
          const cognitiveLoadRaw = getColumnValue(task, 'עומס קוגניטיבי', true);
          const treatmentRoom = getColumnValue(task, 'אולם טיפול', false) || '';

          const statusFromMonday = statusRaw?.label || 'מתוכנן';
          const normalizedStatus = {
            'מתוכנן': 'planned',
            'הושלם': 'completed', 
            'בוטל': 'cancelled',
          }[statusFromMonday] || 'planned';

          const cognitiveLoadFromMonday = cognitiveLoadRaw?.label || 'בינוני';
          const normalizedCognitiveLoad = {
            'נמוך': 'low',
            'בינוני': 'medium',
            'גבוה': 'high',
          }[cognitiveLoadFromMonday] || 'medium';

          // Format date for the treatment object
          const formattedDate = format(treatmentDate, 'yyyy-MM-dd') + 'T00:00:00.000Z';

          return {
            id: `monday-${task.id}`,
            date: formattedDate,
            start: startTime,
            end: endTime,
            patient: task.client_name || 'לא צוין',
            location: task.location || 'לא צוין',
            therapist: getColumnValue(task, 'מטפל/ת', false) || '',
            treatmentType: task.title || 'טיפול לא מזוהה',
            notes: task.description || '',
            treatmentRoom: treatmentRoom,
            status: normalizedStatus,
            calmPlanId: task.monday_item_id || task.id,
            cognitiveLoad: normalizedCognitiveLoad,
            isFromMonday: true,
            originalMondayData: task
          };
        });

        console.log('🔍 DEBUG: Converted treatments:', convertedTreatments);

        setMondayTreatments(convertedTreatments);
        
        // Merge with existing treatments, ensuring no duplication
        setTreatments(prev => {
          const nonMondayTreatments = prev.filter(t => !t.isFromMonday);
          return [...nonMondayTreatments, ...convertedTreatments];
        });
        
      } catch (error) {
        console.error("❌ Failed to load Monday treatments:", error);
        setMondayTreatments([]);
      }
    };

    loadMondayTreatments();
  }, [weekStartDate]); // Re-run when the selected week changes

  const manualSave = async () => {
    if (treatments.length === 0) {
      setSaveStatus('saved'); // If no treatments, nothing to save, consider it saved.
      setLastSaved(new Date());
      return;
    }
    setSaveStatus('saving');
    try {
      const formattedStartDate = format(weekStartDate, 'yyyy-MM-dd');

      const existing = await WeeklySchedule.filter({ weekStartDate: formattedStartDate });

      // Filter out treatments that are from Monday and not modified, if they shouldn't be saved locally
      // For now, all treatments are saved to the local WeeklySchedule
      const treatmentsToSave = treatments.map(t => ({
        day: getDay(new Date(t.date)), // Use getDay from date-fns
        startTime: t.start,
        endTime: t.end,
        type: 'treatment',
        location: t.location || '',
        assignedTo: t.patient || '', // FIX: Changed null to empty string to match schema
        therapist: t.therapist || '',
        notes: t.notes || '',
        treatmentType: t.treatmentType || '',
        treatmentRoom: t.treatmentRoom || '',
        status: t.status || 'planned',
        calmPlanId: t.calmPlanId || '',
        cognitiveLoad: t.cognitiveLoad || 'medium',
        isFromMonday: t.isFromMonday || false, // Preserve this flag
        isModified: t.isModified || false // Preserve this flag
      }));

      const scheduleData = {
        userId: 'current_user',
        householdId: 'default_household',
        weekStartDate: formattedStartDate,
        status: 'draft',
        fixedBlocks: treatmentsToSave
      };

      if (existing && existing.length > 0) {
        await WeeklySchedule.update(existing[0].id, scheduleData);
      } else {
        await WeeklySchedule.create(scheduleData);
      }
      setSaveStatus('saved');
      setLastSaved(new Date());
    } catch (error) {
      console.error("Save failed:", error);
      setSaveStatus('error');
    }
  };

  useEffect(() => {
    if (saveStatus === 'saving') { // Trigger auto-save only when there are pending changes
      const saveTimer = setTimeout(manualSave, 3000);
      return () => clearTimeout(saveTimer);
    } else if (saveStatus === null) {
      // If initial load and there are existing treatments, trigger an initial save
      if (treatments.length > 0) {
        setSaveStatus('saving');
      } else {
        setSaveStatus('saved'); // If no treatments initially, nothing to save.
        setLastSaved(new Date());
      }
    }
  }, [saveStatus, treatments, weekStartDate]);

  useEffect(() => {
    const newConflicts = {};
    let totalTreatmentMinutes = 0;
    const treatmentDays = new Set();

    // Group treatments by date
    const treatmentsByDate = treatments.reduce((acc, t) => {
      // Ensure t.date is a valid date string
      if (!t.date || isNaN(new Date(t.date).getTime())) {
        console.warn('Invalid date for treatment:', t);
        return acc;
      }
      const dateKey = format(new Date(t.date), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(t);
      return acc;
    }, {});

    Object.values(treatmentsByDate).forEach(daySchedule => {
      daySchedule.forEach((t1, i) => {
        if (t1.start && t1.end) {
          const duration = calculateDuration(t1.start, t1.end);
          if (duration > 0) {
            totalTreatmentMinutes += duration;
            treatmentDays.add(format(new Date(t1.date), 'yyyy-MM-dd'));
          }
        }
        for (let j = i + 1; j < daySchedule.length; j++) {
          const t2 = daySchedule[j];
          if (t1.start && t1.end && t2.start && t2.end) {
            if ((t1.start < t2.end) && (t1.end > t2.start)) {
              if (!newConflicts[t1.id]) newConflicts[t1.id] = true;
              if (!newConflicts[t2.id]) newConflicts[t2.id] = true;
            }
          }
        }
      });
    });

    setConflicts(newConflicts);

    const treatmentDaysCount = treatmentDays.size;
    const totalTravelHours = treatmentDaysCount * TRAVEL_HOURS_PER_TREATMENT_DAY;
    const totalTreatmentHours = totalTreatmentMinutes / 60;
    const totalWorkHoursLost = totalTreatmentHours + totalTravelHours;
    setSummary({
      totalTreatmentHours,
      totalTravelHours,
      totalWorkHoursLost,
      availableWorkHours: (daysOfWeek.length * WORK_HOURS_PER_DAY) - totalWorkHoursLost,
      treatmentDaysCount
    });
  }, [treatments]);

  const handleAddTreatment = (dayKey) => {
    const dayIndex = daysOfWeek.find(d => d.key === dayKey).dayIndex;
    const newTreatmentDate = addDays(weekStartDate, dayIndex);

    const newTreatment = {
      id: `new-${crypto.randomUUID()}`, // Client-side temporary ID
      date: newTreatmentDate.toISOString(), // New date field for the treatment
      start: '',
      end: '',
      patient: null, // New patient field
      location: '',
      therapist: '',
      treatmentType: '',
      notes: '',
      treatmentRoom: '',
      status: 'planned',
      calmPlanId: `CP-${crypto.randomUUID()}`,
      cognitiveLoad: 'low',
      isFromMonday: false, // Flag for newly added treatments
      isModified: false, // Flag for modification status
    };
    setTreatments(prev => [...prev, newTreatment]);
    setSaveStatus('saving');
  };

  const handleRemoveTreatment = (treatmentId) => {
    setTreatments(prev => prev.filter(t => t.id !== treatmentId));
    setSaveStatus('saving');
  };

  const handleTreatmentChange = (treatmentId, field, value) => {
    // If changing the date, check if we need to switch weeks
    if (field === 'date' && value) {
      const newTreatmentDate = new Date(value);
      if (isValid(newTreatmentDate)) {
        const currentWeekEnd = addDays(weekStartDate, 7);
        const isOutsideCurrentWeek = newTreatmentDate < weekStartDate || newTreatmentDate >= currentWeekEnd;

        if (isOutsideCurrentWeek) {
          // FIX: Always calculate week start as Sunday
          const newWeekStart = startOfWeek(newTreatmentDate, { weekStartsOn: 0 });
          setWeekStartDate(newWeekStart);
          
          // Automatically switch the selected day view to the day of the moved treatment
          const newDayIndex = getDay(newTreatmentDate); // 0 for Sunday, 1 for Monday, etc.
          const newDayKey = daysOfWeek.find(d => d.dayIndex === newDayIndex)?.key;
          if (newDayKey) {
            setSelectedDayKey(newDayKey);
          }
        }
      }
    }

    // Special handling for Monday treatments
    const treatment = treatments.find(t => t.id === treatmentId);
    if (treatment?.isFromMonday) {
      // For Monday treatments, allow editing but mark as modified
      setTreatments(prev => prev.map(t =>
        t.id === treatmentId
          ? { ...t, [field]: value, isModified: true }
          : t
      ));
    } else {
      // Regular treatment change logic
      // Automation: If changing treatment type, clear the therapist selection to force re-selection
      if (field === 'treatmentType') {
        setTreatments(prev => prev.map(t =>
          t.id === treatmentId ? { ...t, therapist: '', [field]: value } : t
        ));
      } else {
        setTreatments(prev => prev.map(t => {
          if (t.id === treatmentId) {
            let updatedTreatment = { ...t, [field]: value };

            // Automation: If a therapist is selected, try to set location based on their workplace
            if (field === 'therapist') {
              const selectedTherapist = allTherapists.find(therapist => therapist.name === value);
              if (selectedTherapist?.workplace) {
                updatedTreatment.location = selectedTherapist.workplace;
              } else {
                // Fallback to existing hardcoded hospital logic if no workplace is defined for the therapist
                const hospitalTherapists = [
                  'דר מוחמד ח\'מאיסי-שיקום',
                  'דר סברדליק-פסיכיאטריה',
                  'מרים רבנו-אחות'
                ];
                if (hospitalTherapists.includes(value)) {
                  updatedTreatment.location = 'ביה"ח שיבא';
                }
              }
            }

            // New Automation: If patient is Yair, set location to hospital
            if (field === 'patient' && value === 'יאיר') {
              updatedTreatment.location = 'ביה"ח שיבא';
            }

            return updatedTreatment;
          }
          return t;
        }));
      }
    }
    setSaveStatus('saving');
  };

  const handleCreatePlan = async () => {
    setIsLoading(true);
    await manualSave(); // Ensure data is saved before creating the plan
    try {
      // The createWeeklyPlan function needs to be adapted to receive the new `treatments` structure
      const result = await createWeeklyPlan({
        treatments, // Sending the flat array
        weekStartDate: format(weekStartDate, 'yyyy-MM-dd')
      });
      if (result.data.success) {
        onPlanCreated(weekStartDate);
      } else {
        throw new Error(result.data.error || 'Failed to create plan');
      }
    } catch (error) {
      console.error("Error creating plan:", error);
    }
    setIsLoading(false);
  };

  const SaveStatusIcon = () => {
    const statusMap = {
      saving: <RotateCcw className="w-4 h-4 animate-spin text-blue-500" />,
      error: <AlertCircleIcon className="w-4 h-4 text-red-500" />,
      saved: <Cloud className="w-4 h-4 text-green-500" />,
      null: <Cloud className="w-4 h-4 text-gray-400" />, // Initial state before any save action
    };
    return statusMap[saveStatus] || null;
  };

  const currentDayData = daysOfWeek.find(d => d.key === selectedDayKey);
  // Filter treatments for the currently selected day based on their date
  const currentDayTreatments = treatments.filter(t =>
    currentDayData &&
    t.date &&
    getDay(new Date(t.date)) === currentDayData.dayIndex &&
    new Date(t.date) >= weekStartDate &&
    new Date(t.date) < addDays(weekStartDate, 7) // Ensure it's within the selected week view
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl text-primary"><Brain className="w-8 h-8" />הזנת טיפולים ותכנון שבוע</CardTitle>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <Button onClick={manualSave} variant="ghost" size="icon" className="w-6 h-6" disabled={saveStatus === 'saving'}>
                  <SaveStatusIcon />
                </Button>
                <span>
                  {saveStatus === 'saving' ? 'שומר...' :
                    saveStatus === 'error' ? 'שגיאה בשמירה' :
                      lastSaved ? `נשמר ${format(lastSaved, 'HH:mm')}` : 'כל השינויים נשמרו'}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">בחר יום לעריכה</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setSelectedDayKey(daysOfWeek[(daysOfWeek.findIndex(d => d.key === selectedDayKey) + daysOfWeek.length - 1) % daysOfWeek.length].key)}><ChevronRight className="w-4 h-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => setSelectedDayKey(daysOfWeek[(daysOfWeek.findIndex(d => d.key === selectedDayKey) + 1) % daysOfWeek.length].key)}><ChevronLeft className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <Label htmlFor="week-start-date" className="text-base font-medium">עבור שבוע המתחיל ב:</Label>
                <Input
                  id="week-start-date"
                  type="date"
                  value={format(weekStartDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    // FIX: Always ensure the selected date becomes the Sunday of that week
                    const selectedDate = new Date(e.target.value.replace(/-/g, '/'));
                    const sundayOfThatWeek = startOfWeek(selectedDate, { weekStartsOn: 0 });
                    setWeekStartDate(sundayOfThatWeek);
                  }}
                  className="w-48"
                />
              </div>

              <div className="flex gap-2 flex-wrap pt-2">
                {daysOfWeek.map(day => {
                  // Filter treatments for the specific day to count them
                  const dayTreatments = treatments.filter(t => {
                    const treatmentDate = new Date(t.date);
                    // Ensure the treatment date falls within the current week view
                    // and its day of the week matches the current day button
                    return treatmentDate >= weekStartDate &&
                           treatmentDate < addDays(weekStartDate, 7) &&
                           getDay(treatmentDate) === day.dayIndex;
                  });
                  return (
                    <Button key={day.key} variant={selectedDayKey === day.key ? "default" : "outline"} onClick={() => setSelectedDayKey(day.key)} className="flex-1 min-w-[100px]">
                      {day.name}
                      {dayTreatments.length > 0 && <Badge variant="secondary" className="mr-2">{dayTreatments.length}</Badge>}
                    </Button>
                  )
                })}
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">
                  {currentDayData.name} - {format(addDays(weekStartDate, currentDayData.dayIndex), 'dd/MM/yyyy')}
                </CardTitle>
                <Button onClick={() => handleAddTreatment(selectedDayKey)} size="sm" variant="outline"><PlusCircle className="w-4 h-4 ml-2" />הוסף טיפול</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentDayTreatments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">אין טיפולים ליום זה.</p>
              ) : (
                currentDayTreatments.map((treatment, index) => {
                  // Filter therapists based on selected treatment type
                  const filteredTherapists = allTherapists.filter(therapist => {
                    // If no treatment type is selected, or if type is 'אחר', show all therapists
                    if (!treatment.treatmentType || treatment.treatmentType === 'אחר') {
                        return true;
                    }
                    // Otherwise, filter by specialty
                    return therapist.specialties && therapist.specialties.includes(treatment.treatmentType);
                  });

                  return (
                  <div key={treatment.id} className={`p-4 rounded-lg border space-y-3 ${conflicts[treatment.id] ? 'border-red-500 bg-red-50' : 'border-gray-200'} ${treatment.isFromMonday ? 'bg-blue-50 border-blue-200' : ''}`}>
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold flex items-center gap-2">
                          טיפול #{index + 1}
                          {treatment.isFromMonday && (
                            <Badge variant="secondary" className="text-xs">
                              מ-Monday
                            </Badge>
                          )}
                      </h4>
                      <div className="flex items-center gap-2">
                        {treatment.status && (
                          <Badge className={statusOptions.find(s => s.value === treatment.status)?.color || 'bg-gray-100'}>
                            {statusOptions.find(s => s.value === treatment.status)?.label || treatment.status}
                          </Badge>
                        )}
                        <Button onClick={() => handleRemoveTreatment(treatment.id)} size="icon" variant="ghost" className="text-red-500"><XCircle className="w-4 h-4" /></Button>
                      </div>
                    </div>

                    {/* מטופל - ראשון */}
                    <div>
                      <Label>מטופל</Label>
                      <Select value={treatment.patient || ''} onValueChange={(value) => handleTreatmentChange(treatment.id, 'patient', value)}>
                        <SelectTrigger><SelectValue placeholder="בחר מטופל" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>ללא</SelectItem>
                          {patientOptions.map(p => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* סוג טיפול - לפני המטפל */}
                    <div>
                      <Label>סוג טיפול</Label>
                      <Select value={treatment.treatmentType || ''} onValueChange={(value) => handleTreatmentChange(treatment.id, 'treatmentType', value)}>
                        <SelectTrigger><SelectValue placeholder="בחר סוג טיפול" /></SelectTrigger>
                        <SelectContent>{treatmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {/* תאריך ושעות */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>תאריך</Label>
                        <Input
                            type="date"
                            value={treatment.date ? format(new Date(treatment.date), 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                                if(e.target.value) {
                                    handleTreatmentChange(treatment.id, 'date', new Date(e.target.value.replace(/-/g, '/')).toISOString())
                                }
                            }}
                        />
                      </div>
                      <div>
                        <Label>שעת התחלה</Label>
                        <Input type="time" value={treatment.start} onChange={(e) => handleTreatmentChange(treatment.id, 'start', e.target.value)} placeholder="שעת התחלה" />
                      </div>
                      <div>
                        <Label>שעת סיום</Label>
                        <Input type="time" value={treatment.end} onChange={(e) => handleTreatmentChange(treatment.id, 'end', e.target.value)} placeholder="שעת סיום" />
                      </div>
                    </div>

                    {/* מטפל (דינאמי) ואולם טיפול */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>מטפל/ת</Label>
                        <Select
                          value={treatment.therapist || ''}
                          onValueChange={(value) => handleTreatmentChange(treatment.id, 'therapist', value)}
                          disabled={!treatment.treatmentType} // Disable if treatment type is not selected
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={treatment.treatmentType ? "בחר מטפל/ת" : "בחר סוג טיפול קודם"} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredTherapists.map(t => (
                              <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                            ))}
                             <SelectItem value="אחר">אחר</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>אולם טיפול</Label>
                        <Select value={treatment.treatmentRoom || ''} onValueChange={(value) => handleTreatmentChange(treatment.id, 'treatmentRoom', value)}>
                          <SelectTrigger><SelectValue placeholder="בחר אולם" /></SelectTrigger>
                          <SelectContent>
                            {treatmentRoomOptions.map(room => <SelectItem key={room} value={room}>{room}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* מיקום */}
                    <div>
                      <Label>מיקום</Label>
                      <Select value={treatment.location || ''} onValueChange={(value) => handleTreatmentChange(treatment.id, 'location', value)}>
                        <SelectTrigger><SelectValue placeholder="בחר מיקום" /></SelectTrigger>
                        <SelectContent>
                          {locationOptions.map(location => <SelectItem key={location} value={location}>{location}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* סטטוס ועומס קוגניטיבי */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>סטטוס</Label>
                        <Select value={treatment.status || 'planned'} onValueChange={(value) => handleTreatmentChange(treatment.id, 'status', value)}>
                          <SelectTrigger><SelectValue placeholder="בחר סטטוס" /></SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(status => (
                              <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>עומס קוגניטיבי</Label>
                        <Select value={treatment.cognitiveLoad || 'medium'} onValueChange={(value) => handleTreatmentChange(treatment.id, 'cognitiveLoad', value)}>
                          <SelectTrigger><SelectValue placeholder="בחר עומס" /></SelectTrigger>
                          <SelectContent>
                            {cognitiveLoadOptions.map(load => (
                              <SelectItem key={load.value} value={load.value}>{load.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* ID CalmPlan */}
                    <div>
                      <Label>ID CalmPlan</Label>
                      <Input
                        value={treatment.calmPlanId || ''}
                        onChange={(e) => handleTreatmentChange(treatment.id, 'calmPlanId', e.target.value)}
                        placeholder="מתמלא אוטומטית"
                        readOnly
                        className="bg-gray-100 cursor-not-allowed"
                      />
                    </div>

                    {/* הערות */}
                    <div>
                      <Label>הערות</Label>
                      <Textarea
                        placeholder="הערות על הטיפול..."
                        value={treatment.notes}
                        onChange={(e) => handleTreatmentChange(treatment.id, 'notes', e.target.value)}
                        className="h-20"
                      />
                    </div>
                  </div>
                )})
              )}
            </CardContent>
          </Card>
        </div>
        <div className="sticky top-6">
          <Card className="shadow-md">
            <CardHeader><CardTitle>סיכום שבועי</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p>ימי טיפולים: {summary.treatmentDaysCount}</p>
              <p>שעות טיפול: {summary.totalTreatmentHours?.toFixed(1)}</p>
              <p>שעות נסיעה: {summary.totalTravelHours?.toFixed(1)}</p>
              <p>סה"כ שעות אבודות לעבודה: {summary.totalWorkHoursLost?.toFixed(1)}</p>
              <p className="font-bold">שעות עבודה פנויות: {summary.availableWorkHours?.toFixed(1)}</p>
              {Object.keys(conflicts).length > 0 && <Alert variant="destructive"><AlertCircleIcon className="h-4 w-4" /><AlertTitle>קיימות התנגשויות בלו"ז!</AlertTitle></Alert>}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardFooter className="flex justify-between items-center p-4">
          {onCancel && <Button onClick={onCancel} variant="outline" className="flex items-center gap-2"><ArrowLeft className="w-4 h-4" />חזור</Button>}
          <div className="flex gap-4">
            <Button onClick={handleCreatePlan} disabled={isLoading || treatments.length === 0 || Object.keys(conflicts).length > 0} size="lg" className="bg-green-600 hover:bg-green-700">
              {isLoading ? 'יוצר תכנון...' : 'צור תכנון שבועי חכם'}
              <CheckCircle className="w-5 h-5 mr-2" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
