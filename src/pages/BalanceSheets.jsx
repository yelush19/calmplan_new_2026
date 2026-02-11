import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BalanceSheet } from '@/api/entities';
import { Client } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart3,
  Plus,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Building2,
  Calendar,
  User
} from 'lucide-react';
import { generateProcessTasks } from '@/api/functions';

const statusConfig = {
  under_review_required: { label: 'דרוש סקירה', color: 'bg-yellow-200 text-yellow-800', icon: AlertCircle },
  completed: { label: 'הושלם', color: 'bg-green-200 text-green-800', icon: CheckCircle },
  final_editing_stages: { label: 'שלבי עריכה סופיים', color: 'bg-blue-200 text-blue-800', icon: FileText },
  sent_for_audit: { label: 'נשלח לביקורת', color: 'bg-purple-200 text-purple-800', icon: Building2 },
  awaiting_audit_responses: { label: 'ממתין לתגובות ביקורת', color: 'bg-orange-200 text-orange-800', icon: Clock },
  signed: { label: 'חתום', color: 'bg-green-200 text-green-800', icon: CheckCircle },
  in_process: { label: 'בתהליך', color: 'bg-blue-200 text-blue-800', icon: Clock },
  ready_to_send_in_folder: { label: 'מוכן לשליחה בתיקייה', color: 'bg-teal-200 text-teal-800', icon: FileText },
};

const BalanceSheetCard = ({ balance, onStatusChange }) => {
  const StatusIcon = statusConfig[balance.status_tracking]?.icon || Clock;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl mb-2">{balance.client_name}</CardTitle>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-sm">
                  שנת מס: {balance.tax_year}
                </Badge>
                {balance.assigned_to && (
                  <Badge variant="secondary" className="text-sm">
                    <User className="w-3 h-3 ml-1" />
                    {balance.assigned_to}
                  </Badge>
                )}
              </div>
              <Badge className={statusConfig[balance.status_tracking]?.color || 'bg-gray-200 text-gray-800'}>
                <StatusIcon className="w-4 h-4 ml-2" />
                {statusConfig[balance.status_tracking]?.label || balance.status_tracking}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-grow flex flex-col justify-between">
          <div className="space-y-3">
            {balance.audit_secretary && (
              <div className="text-sm text-gray-600">
                <strong>מזכירת ביקורת:</strong> {balance.audit_secretary}
              </div>
            )}
            
            {balance.start_date && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>תאריך התחלה: {new Date(balance.start_date).toLocaleDateString('he-IL')}</span>
              </div>
            )}
            
            {balance.audit_send_date && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>תאריך שליחה לביקורת: {new Date(balance.audit_send_date).toLocaleDateString('he-IL')}</span>
              </div>
            )}
            
            {/* הצגת סטטוס שלבי העבודה */}
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-2 rounded text-center ${
                  balance.bank_reconciliations === 'completed' ? 'bg-green-100 text-green-800' :
                  balance.bank_reconciliations === 'in_process' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  התאמות בנק: {balance.bank_reconciliations === 'completed' ? 'הושלם' : 
                               balance.bank_reconciliations === 'in_process' ? 'בתהליך' : 'תקוע'}
                </div>
                <div className={`p-2 rounded text-center ${
                  balance.supplier_client_reconciliations === 'completed' ? 'bg-green-100 text-green-800' :
                  balance.supplier_client_reconciliations === 'in_process' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  התאמות ספקים/לקוחות: {balance.supplier_client_reconciliations === 'completed' ? 'הושלם' : 
                                        balance.supplier_client_reconciliations === 'in_process' ? 'בתהליך' : 'תקוע'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <Select
              value={balance.status_tracking}
              onValueChange={(newStatus) => onStatusChange(balance.id, newStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function BalanceSheetsPage() {
  const [balanceSheets, setBalanceSheets] = useState([]);
  const [clients, setClients] = useState([]);
  const [filters, setFilters] = useState({ status: 'all', client: 'all', year: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [balancesData, clientsData] = await Promise.all([
        BalanceSheet.list().catch(() => []),
        Client.list().catch(() => [])
      ]);
      setBalanceSheets(balancesData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleStatusChange = async (id, status) => {
    try {
      await BalanceSheet.update(id, { status_tracking: status });
      loadData();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleGenerateBalanceSheetTasks = async () => {
    setIsGeneratingTasks(true);
    setGenerationResult(null);
    
    try {
      const response = await generateProcessTasks({ taskType: 'balanceSheets' });
      
      if (response.data.success) {
        setGenerationResult({
          type: 'success',
          message: response.data.message,
          details: response.data.results
        });
        loadData();
      } else {
        setGenerationResult({
          type: 'error',
          message: response.data.message || 'שגיאה ביצירת משימות'
        });
      }
    } catch (error) {
      console.error("Error generating balance sheet tasks:", error);
      setGenerationResult({
        type: 'error',
        message: 'שגיאה בקריאה לפונקציה'
      });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const filteredBalances = React.useMemo(() => {
    return balanceSheets.filter(balance =>
      (filters.status === 'all' || balance.status_tracking === filters.status) &&
      (filters.client === 'all' || balance.client_name === filters.client) &&
      (filters.year === 'all' || balance.tax_year === filters.year)
    );
  }, [balanceSheets, filters]);

  const progress = balanceSheets.length > 0 ?
    (balanceSheets.filter(b => ['completed', 'signed'].includes(b.status_tracking)).length / balanceSheets.length) * 100 : 0;

  const availableYears = [...new Set(balanceSheets.map(b => b.tax_year))].filter(Boolean).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-center gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-full">
            <BarChart3 className="w-8 h-8 text-purple-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">לוח מאזנים</h1>
            <p className="text-gray-600">ניהול ומעקב אחר כל המאזנים השנתיים של הלקוחות.</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleGenerateBalanceSheetTasks}
            disabled={isGeneratingTasks}
            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
          >
            <RefreshCw className={`w-4 h-4 ml-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
            {isGeneratingTasks ? 'יוצר משימות...' : 'צור משימות מאזנים'}
          </Button>
        </div>
      </motion.div>

      {/* הודעת תוצאת יצירת משימות */}
      {generationResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg border ${
            generationResult.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {generationResult.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{generationResult.message}</span>
          </div>
          
          {generationResult.details && generationResult.type === 'success' && (
            <div className="text-sm">
              <p>משימות נוצרו: {generationResult.details.summary.tasksCreated}</p>
              <p>משימות דולגו (כבר קיימות): {generationResult.details.summary.tasksSkipped}</p>
              {generationResult.details.balanceSheets.length > 0 && (
                <div className="mt-2">
                  <strong>משימות חדשות שנוצרו:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {generationResult.details.balanceSheets.map((item, index) => (
                      <li key={index}>{item.taskTitle}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setGenerationResult(null)}
            className="mt-2 p-0 h-auto"
          >
            סגור הודעה
          </Button>
        </motion.div>
      )}

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>התקדמות כוללת</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="w-full" />
          <p className="text-center mt-2 text-sm text-gray-600">{Math.round(progress)}% הושלמו</p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            סינון
          </CardTitle>
          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <Select onValueChange={(value) => setFilters(f => ({ ...f, status: value }))} value={filters.status}>
              <SelectTrigger><SelectValue placeholder="סנן לפי סטטוס" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select onValueChange={(value) => setFilters(f => ({ ...f, year: value }))} value={filters.year}>
              <SelectTrigger><SelectValue placeholder="סנן לפי שנה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל השנים</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select onValueChange={(value) => setFilters(f => ({ ...f, client: value }))} value={filters.client}>
              <SelectTrigger><SelectValue placeholder="סנן לפי לקוח" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.name}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Balance Sheets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-gray-100"></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBalances.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">לא נמצאו מאזנים מתאימים לסינון הנוכחי</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredBalances.map(balance => (
                <BalanceSheetCard
                  key={balance.id}
                  balance={balance}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}