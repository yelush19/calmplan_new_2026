import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Smile, Meh, Frown, RefreshCw } from 'lucide-react';

const MOOD_OPTIONS = [
  { emoji: '😔', value: 2, label: 'קשה לי', level: 'low' },
  { emoji: '😐', value: 5, label: 'ככה ככה', level: 'medium' },
  { emoji: '🙂', value: 7, label: 'בסדר', level: 'medium' },
  { emoji: '😊', value: 9, label: 'מרגישה טוב!', level: 'high' },
];

const CALMING_MESSAGES = [
  'את לא לבד — קחי רק משימה אחת קלה היום',
  'יום קשה? זה בסדר. נתחיל בקטן',
  'גם צעד קטן הוא צעד קדימה',
  'היום עושים רק מה שאפשר — בלי לחץ',
  'נשמע שיום רגוע יותר יעשה טוב. נתמקד בקל',
];

const ENCOURAGING_MESSAGES = [
  'יום טוב לדברים גדולים!',
  'האנרגיה שלך גבוהה — בואי ננצל את זה',
  'את במיטבך! הנה המשימות שמחכות',
];

function pickDailyMessage(messages) {
  const dayIndex = new Date().getDate() % messages.length;
  return messages[dayIndex];
}

export default function MoodCheckerInline({ onMoodChange }) {
  const [todaysMood, setTodaysMood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTodaysMood();
  }, []);

  const loadTodaysMood = async () => {
    try {
      const { DailyMoodCheck } = await import('@/api/entities');
      const today = new Date().toISOString().split('T')[0];
      const results = await DailyMoodCheck.filter({ date: today });
      if (results[0]) {
        const mood = results[0].morning?.mood;
        setTodaysMood({ id: results[0].id, mood });
        if (mood && onMoodChange) onMoodChange(mood);
      }
    } catch (error) {
      console.error('MoodChecker: error loading mood', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMood = async (moodOption) => {
    setSaving(true);
    try {
      const { DailyMoodCheck, User } = await import('@/api/entities');
      const user = await User.me();
      const today = new Date().toISOString().split('T')[0];

      const moodData = {
        userId: user.id,
        date: today,
        morning: {
          time: new Date().toISOString().split('T')[1].slice(0, 5),
          mood: moodOption.value,
          energy: moodOption.value,
          stress: 10 - moodOption.value,
          notes: '',
        },
      };

      if (todaysMood?.id) {
        await DailyMoodCheck.update(todaysMood.id, moodData);
      } else {
        await DailyMoodCheck.create(moodData);
      }

      setTodaysMood({ id: todaysMood?.id || 'new', mood: moodOption.value });
      if (onMoodChange) onMoodChange(moodOption.value);
    } catch (error) {
      console.error('MoodChecker: error saving mood', error);
    } finally {
      setSaving(false);
    }
  };

  const resetMood = () => {
    setTodaysMood(null);
    if (onMoodChange) onMoodChange(null);
  };

  if (loading) return null;

  // Already answered — show compact result
  if (todaysMood?.mood) {
    const mood = todaysMood.mood;
    const isLow = mood <= 4;
    const isHigh = mood >= 8;
    const message = isLow
      ? pickDailyMessage(CALMING_MESSAGES)
      : isHigh
        ? pickDailyMessage(ENCOURAGING_MESSAGES)
        : null;

    const option = MOOD_OPTIONS.reduce((best, opt) =>
      Math.abs(opt.value - mood) < Math.abs(best.value - mood) ? opt : best
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mt-2 flex-wrap"
      >
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
          style={{
            backgroundColor: isLow ? '#F0F9FF' : isHigh ? '#F0FDF4' : '#FFFBEB',
            border: `1px solid ${isLow ? '#BAE6FD' : isHigh ? '#BBF7D0' : '#FDE68A'}`,
            color: isLow ? '#0369A1' : isHigh ? '#15803D' : '#92400E',
          }}
        >
          <span className="text-sm">{option.emoji}</span>
          <span>{option.label}</span>
          <button
            onClick={resetMood}
            className="mr-1 opacity-50 hover:opacity-100 transition-opacity"
            title="עדכני מצב רוח"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        {message && (
          <span className="text-xs text-slate-500 italic">{message}</span>
        )}
      </motion.div>
    );
  }

  // Not yet answered — show mood picker
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Heart className="w-3 h-3 text-purple-400" />
          איך את מרגישה היום?
        </span>
        <div className="flex gap-1.5">
          {MOOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => saveMood(opt)}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                color: '#475569',
              }}
              title={opt.label}
            >
              <span className="text-sm">{opt.emoji}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
