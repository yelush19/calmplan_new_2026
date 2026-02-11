import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smile, Meh, Frown, Heart, Brain } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MoodTracker() {
  const [todaysMood, setTodaysMood] = useState(null);
  const [yesterdaysMood, setYesterdaysMood] = useState(null);

  useEffect(() => {
    loadMoodData();
  }, []);

  const loadMoodData = async () => {
    try {
      const { DailyMoodCheck } = await import('@/api/entities');
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const [todayData, yesterdayData] = await Promise.all([
        DailyMoodCheck.filter({ date: today }),
        DailyMoodCheck.filter({ date: yesterday })
      ]);

      setTodaysMood(todayData[0] || null);
      setYesterdaysMood(yesterdayData[0] || null);
    } catch (error) {
      console.error('Error loading mood data:', error);
    }
  };

  const saveMood = async (mood) => {
    try {
      const { DailyMoodCheck, User } = await import('@/api/entities');
      const user = await User.me();
      const today = new Date().toISOString().split('T')[0];

      const moodData = {
        userId: user.id,
        date: today,
        morning: {
          time: new Date().toISOString().split('T')[1].slice(0, 5),
          mood: mood,
          energy: mood,
          stress: 10 - mood,
          notes: ''
        }
      };

      if (todaysMood) {
        await DailyMoodCheck.update(todaysMood.id, moodData);
      } else {
        await DailyMoodCheck.create(moodData);
      }

      setTodaysMood({ ...moodData, id: todaysMood?.id || 'new' });
    } catch (error) {
      console.error('Error saving mood:', error);
    }
  };

  const getMoodIcon = (mood) => {
    if (mood >= 8) return <Smile className="w-6 h-6 text-green-500" />;
    if (mood >= 5) return <Meh className="w-6 h-6 text-yellow-500" />;
    return <Frown className="w-6 h-6 text-red-500" />;
  };

  const getMoodText = (mood) => {
    if (mood >= 8) return 'מצב רוח מעולה';
    if (mood >= 5) return 'מצב רוח בינוני';
    return 'מצב רוח לא טוב';
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-purple-600" />
          איך אתה מרגיש היום?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {yesterdaysMood && (
          <div className="p-3 bg-white rounded-lg">
            <p className="text-sm text-gray-600 mb-1">אתמול:</p>
            <div className="flex items-center gap-2">
              {getMoodIcon(yesterdaysMood.morning?.mood || 5)}
              <span className="text-sm">{getMoodText(yesterdaysMood.morning?.mood || 5)}</span>
            </div>
          </div>
        )}

        {todaysMood ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-white rounded-lg"
          >
            <p className="text-sm text-gray-600 mb-1">היום:</p>
            <div className="flex items-center gap-2">
              {getMoodIcon(todaysMood.morning?.mood || 5)}
              <span className="text-sm">{getMoodText(todaysMood.morning?.mood || 5)}</span>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">דרג את מצב הרוח שלך (1-10):</p>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(mood => (
                <Button
                  key={mood}
                  variant="outline"
                  size="sm"
                  onClick={() => saveMood(mood)}
                  className="w-10 h-10 p-0"
                >
                  {mood}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}