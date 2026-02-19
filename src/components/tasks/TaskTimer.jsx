import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Play, Pause, Square, Plus, Clock } from "lucide-react";
import { differenceInMinutes } from "date-fns";

export default function TaskTimer({ task, onStop, onCancel }) {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [interruptions, setInterruptions] = useState([]);
  const [sessionData, setSessionData] = useState({
    productivity_rating: 3,
    focus_rating: 3,
    energy_level: "medium",
    completion_status: "completed",
    notes: ""
  });

  useEffect(() => {
    let interval;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsedTime(differenceInMinutes(new Date(), startTime));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const handleStart = () => {
    const now = new Date();
    setStartTime(now);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleInterruption = () => {
    const reason = prompt("מה הסיבה להפרעה?");
    if (reason) {
      setInterruptions(prev => [...prev, {
        time: new Date().toISOString(),
        reason,
        duration_minutes: 2 // ברירת מחדל
      }]);
    }
  };

  const handleComplete = () => {
    const sessionResult = {
      task_id: task.id,
      start_time: startTime.toISOString(),
      end_time: new Date().toISOString(),
      duration_minutes: elapsedTime,
      interruptions,
      ...sessionData
    };
    onStop(sessionResult);
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <Card className="w-full max-w-2xl shadow-2xl bg-white">
        <CardHeader className="bg-gradient-to-l from-green-50 to-blue-50 border-b border-green-200">
          <CardTitle className="flex items-center gap-3 text-2xl text-gray-800">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            טיימר משימה: {task.title}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-8">
          {/* טיימר מרכזי */}
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-gray-800 mb-4">
              {formatTime(elapsedTime)}
            </div>
            <div className="text-lg text-gray-600 mb-6">
              זמן מוערך: {task.estimated_minutes} דקות
            </div>
            
            {/* כפתורי שליטה */}
            <div className="flex justify-center gap-4">
              {!isRunning ? (
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 text-xl"
                >
                  <Play className="w-6 h-6 ml-2" />
                  {startTime ? "המשך" : "התחל"}
                </Button>
              ) : (
                <Button
                  onClick={handlePause}
                  size="lg"
                  variant="outline"
                  className="border-2 border-yellow-400 text-yellow-600 hover:bg-yellow-50 px-8 py-4 text-xl"
                >
                  <Pause className="w-6 h-6 ml-2" />
                  השהה
                </Button>
              )}
              
              <Button
                onClick={handleInterruption}
                size="lg"
                variant="outline"
                className="border-2 border-orange-400 text-orange-600 hover:bg-orange-50 px-6 py-4"
              >
                <Plus className="w-5 h-5 ml-2" />
                הפרעה
              </Button>
            </div>
          </div>

          {/* הפרעות */}
          {interruptions.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">הפרעות ({interruptions.length})</h3>
              <div className="space-y-1 text-sm text-gray-600">
                {interruptions.map((interruption, index) => (
                  <div key={index}>• {interruption.reason}</div>
                ))}
              </div>
            </div>
          )}

          {/* דירוגים */}
          {startTime && (
            <div className="space-y-4 mb-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-base font-medium mb-2 block">דירוג פרודוקטיביות</Label>
                  <Select 
                    value={sessionData.productivity_rating.toString()} 
                    onValueChange={(value) => setSessionData(prev => ({...prev, productivity_rating: parseInt(value)}))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - נמוכה מאוד</SelectItem>
                      <SelectItem value="2">2 - נמוכה</SelectItem>
                      <SelectItem value="3">3 - בינונית</SelectItem>
                      <SelectItem value="4">4 - גבוהה</SelectItem>
                      <SelectItem value="5">5 - גבוהה מאוד</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-base font-medium mb-2 block">דירוג ריכוז</Label>
                  <Select 
                    value={sessionData.focus_rating.toString()} 
                    onValueChange={(value) => setSessionData(prev => ({...prev, focus_rating: parseInt(value)}))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - נמוך מאוד</SelectItem>
                      <SelectItem value="2">2 - נמוך</SelectItem>
                      <SelectItem value="3">3 - בינוני</SelectItem>
                      <SelectItem value="4">4 - גבוה</SelectItem>
                      <SelectItem value="5">5 - גבוה מאוד</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-base font-medium mb-2 block">הערות על הסשן</Label>
                <Textarea
                  value={sessionData.notes}
                  onChange={(e) => setSessionData(prev => ({...prev, notes: e.target.value}))}
                  placeholder="איך הרגשת? מה עזר או הפריע?"
                  className="h-20"
                />
              </div>
            </div>
          )}

          {/* כפתורי סיום */}
          <div className="flex gap-4">
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1 py-3 text-lg"
            >
              ביטול
            </Button>
            
            {startTime && (
              <Button
                onClick={handleComplete}
                className="flex-1 py-3 text-lg bg-blue-500 hover:bg-blue-600"
              >
                <Square className="w-5 h-5 ml-2" />
                סיים וסגור
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}