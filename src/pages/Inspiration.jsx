import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookHeart,
  Music,
  Upload,
  Lightbulb,
  Headphones,
  BookOpen
} from 'lucide-react';
// Note: InvokeLLM integration not yet available - using simulated recommendations

const musicPlaylists = [
    { name: "ריכוז עמוק", icon: Headphones, genre: "Lofi & Ambient", mood: "focus" },
    { name: "בוסט של אנרגיה", icon: Music, genre: "Pop & Dance", mood: "energy" },
    { name: "ניקיון וסדר", icon: Music, genre: "Upbeat Hits", mood: "cleaning" },
    { name: "רוגע ושלווה", icon: Headphones, genre: "Classical & Nature Sounds", mood: "relax" },
]

export default function InspirationPage() {
  const [bookshelfImage, setBookshelfImage] = useState(null);
  const [recommendation, setRecommendation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleImageUpload = (event) => {
    if (event.target.files && event.target.files[0]) {
      setBookshelfImage(URL.createObjectURL(event.target.files[0]));
      // In a real app, you'd upload the file here and get a URL
    }
  };

  const getBookRecommendation = async () => {
    if (!bookshelfImage) {
      setRecommendation("בבקשה העלי תמונה של מדף הספרים שלך תחילה.");
      return;
    }
    setIsLoading(true);
    // Simulated recommendation (LLM integration not yet available)
    const recommendations = [
      "בהתבסס על אהבתך לספרי מתח היסטוריים, אני ממליצה לך על 'צופן דה וינצ'י'. הוא משלב תעלומה, היסטוריה וקצב מסחרר שישאיר אותך במתח עד העמוד האחרון.",
      "נראה שאת אוהבת סיפורים עם דמויות חזקות. נסי את 'בין חברים' של אמי סילברמן - ספר מרגש שמתאים מאוד לערבי שישי.",
      "על בסיס הטעם שלך, ממליצה על 'האלכימאי' מאת פאולו קואלו - ספר קצר ומעורר השראה שאפשר לסיים בישיבה אחת.",
    ];
    setTimeout(() => {
      setRecommendation(recommendations[Math.floor(Math.random() * recommendations.length)]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-4xl font-bold text-pink-800">השראה, פנאי ומה שביניהם</h1>
        <p className="text-xl text-gray-600">פינה קטנה לנפש, עם המלצות לקריאה ומוזיקה שמתאימה בדיוק לך.</p>
      </motion.div>

      {/* המלצות ספרים */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-amber-800">
              <BookHeart className="w-6 h-6" />
              הספר הבא שלך
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">רוצה המלצה לספר הבא? צלמי את מדף הספרים שלך, והמערכת החכמה תציע לך את הספר המושלם להמשך.</p>
            <div className="flex items-center gap-4">
              <Button asChild variant="outline" className="flex-1 bg-white">
                 <label htmlFor="upload-button">
                    <Upload className="w-4 h-4 ml-2" />
                    העלי תמונה של המדף
                 </label>
              </Button>
              <Input id="upload-button" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              
              <Button onClick={getBookRecommendation} disabled={!bookshelfImage || isLoading} className="flex-1 bg-amber-500 hover:bg-amber-600">
                <Lightbulb className="w-4 h-4 ml-2" />
                {isLoading ? "חושבת..." : "קבלי המלצה"}
              </Button>
            </div>
            {bookshelfImage && (
              <div className="mt-4 p-2 border border-dashed border-amber-300 rounded-lg">
                <img src={bookshelfImage} alt="מדף ספרים" className="w-full h-auto max-h-60 object-contain rounded-md"/>
              </div>
            )}
            {recommendation && (
              <Card className="mt-4 bg-white">
                <CardContent className="p-4">
                    <p className="font-medium text-gray-800">{recommendation}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      {/* מוזיקה */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-indigo-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-indigo-800">
              <Music className="w-6 h-6" />
              מוזיקה לפי מצב רוח
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {musicPlaylists.map(playlist => (
                <Card key={playlist.name} className="text-center bg-white hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                        <playlist.icon className="w-10 h-10 mx-auto text-indigo-600 mb-3"/>
                        <p className="font-semibold">{playlist.name}</p>
                        <p className="text-sm text-gray-500">{playlist.genre}</p>
                    </CardContent>
                </Card>
            ))}
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}