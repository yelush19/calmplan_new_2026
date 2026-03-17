import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BookHeart,
  Music,
  Upload,
  Lightbulb,
  Headphones,
  BookOpen,
  Plus,
  Trash2,
  Star,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { InspirationItem, UserPreferences } from '@/api/entities';
import { toast } from 'sonner';

const DEFAULT_PLAYLISTS = [
  { name: "ריכוז עמוק", genre: "Lofi & Ambient", mood: "focus", icon: "headphones" },
  { name: "בוסט של אנרגיה", genre: "Pop & Dance", mood: "energy", icon: "music" },
  { name: "ניקיון וסדר", genre: "Upbeat Hits", mood: "cleaning", icon: "music" },
  { name: "רוגע ושלווה", genre: "Classical & Nature Sounds", mood: "relax", icon: "headphones" },
];

const DEFAULT_BOOKS = [
  { title: "האלכימאי", author: "פאולו קואלו", genre: "השראה", rating: 5 },
  { title: "אטומיק האביטס", author: "ג'יימס קליר", genre: "פיתוח אישי", rating: 5 },
  { title: "Deep Work", author: "קאל ניופורט", genre: "פרודוקטיביות", rating: 4 },
];

export default function InspirationPage() {
  const [books, setBooks] = useState([]);
  const [playlists, setPlaylists] = useState(DEFAULT_PLAYLISTS);
  const [loading, setLoading] = useState(true);
  const [showAddBook, setShowAddBook] = useState(false);
  const [newBook, setNewBook] = useState({ title: '', author: '', genre: '', rating: 5 });
  const [selectedMood, setSelectedMood] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [items, prefs] = await Promise.all([
        InspirationItem.list('-created_date', 100),
        UserPreferences.filter({ key: 'inspiration_playlists' }),
      ]);

      const bookItems = items.filter(i => i.type === 'book');
      setBooks(bookItems.length > 0 ? bookItems : DEFAULT_BOOKS.map((b, i) => ({ ...b, id: `default-${i}`, type: 'book' })));

      if (prefs.length > 0 && prefs[0].value?.playlists) {
        setPlaylists(prefs[0].value.playlists);
      }
    } catch (err) {
      console.error('Failed to load inspiration data:', err);
      setBooks(DEFAULT_BOOKS.map((b, i) => ({ ...b, id: `default-${i}`, type: 'book' })));
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async () => {
    if (!newBook.title.trim()) return;
    try {
      const created = await InspirationItem.create({
        type: 'book',
        title: newBook.title,
        author: newBook.author,
        genre: newBook.genre,
        rating: newBook.rating,
      });
      setBooks(prev => [created, ...prev]);
      setNewBook({ title: '', author: '', genre: '', rating: 5 });
      setShowAddBook(false);
      toast.success('הספר נוסף בהצלחה');
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בהוספת הספר');
    }
  };

  const handleDeleteBook = async (book) => {
    if (String(book.id).startsWith('default-')) return;
    try {
      await InspirationItem.delete(book.id);
      setBooks(prev => prev.filter(b => b.id !== book.id));
      toast.success('הספר הוסר');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 p-6" dir="rtl">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#1E3A5F]">השראה ופנאי</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white flex items-center justify-center gap-2">
          <Lightbulb className="w-6 h-6 text-amber-500" />
          השראה, פנאי ומה שביניהם
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">פינה קטנה לנפש, עם המלצות לקריאה ומוזיקה</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ספרים */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="rounded-xl shadow-sm border hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-[#1E3A5F] dark:text-amber-400 text-base">
                <BookHeart className="w-5 h-5" />
                ספרים מומלצים
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddBook(!showAddBook)} className="gap-1">
                <Plus className="w-3 h-3" />
                הוסף ספר
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {showAddBook && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2 p-3 bg-amber-50 dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-gray-600"
                >
                  <Input
                    value={newBook.title}
                    onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                    placeholder="שם הספר"
                    className="dark:bg-gray-700"
                  />
                  <Input
                    value={newBook.author}
                    onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                    placeholder="מחבר/ת"
                    className="dark:bg-gray-700"
                  />
                  <Input
                    value={newBook.genre}
                    onChange={(e) => setNewBook({ ...newBook, genre: e.target.value })}
                    placeholder="ז'אנר"
                    className="dark:bg-gray-700"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddBook}>שמור</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddBook(false)}>ביטול</Button>
                  </div>
                </motion.div>
              )}

              {books.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">אין ספרים עדיין</p>
                  <p className="text-xs mt-1">הוסיפו ספרים מומלצים</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pe-1">
                  {books.map(book => (
                    <motion.div
                      key={book.id}
                      whileHover={{ scale: 1.01 }}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{book.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.genre && <Badge variant="secondary" className="text-[10px]">{book.genre}</Badge>}
                          <div className="flex gap-0.5">
                            {Array.from({ length: book.rating || 0 }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                      </div>
                      {!String(book.id).startsWith('default-') && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteBook(book)} className="w-7 h-7 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* מוזיקה */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-xl shadow-sm border hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-[#1E3A5F] dark:text-indigo-400 text-base">
                <Music className="w-5 h-5" />
                מוזיקה לפי מצב רוח
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {playlists.map(playlist => {
                const IconComp = playlist.icon === 'headphones' ? Headphones : Music;
                const isSelected = selectedMood === playlist.mood;
                return (
                  <motion.div key={playlist.name} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Card
                      className={`text-center cursor-pointer transition-all border dark:border-gray-700 ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 shadow-md'
                          : 'bg-white dark:bg-gray-800 hover:shadow-md'
                      }`}
                      onClick={() => setSelectedMood(isSelected ? null : playlist.mood)}
                    >
                      <CardContent className="p-4">
                        <IconComp className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-[#1E3A5F] dark:text-gray-400'}`} />
                        <p className="font-semibold text-sm dark:text-gray-200">{playlist.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{playlist.genre}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
