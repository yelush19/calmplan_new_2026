import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";

export default function RecurrenceForm({ pattern, setPattern }) {
  const handleTypeChange = (type) => {
    setPattern({ ...pattern, type });
  };

  const handleIntervalChange = (e) => {
    setPattern({ ...pattern, interval: parseInt(e.target.value) || 1 });
  };

  const handleDaysOfWeekChange = (days) => {
    setPattern({ ...pattern, days_of_week: days.map(Number) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>תדירות</Label>
        <Select onValueChange={handleTypeChange} value={pattern.type}>
          <SelectTrigger>
            <SelectValue placeholder="בחר תדירות..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">יומי</SelectItem>
            <SelectItem value="weekly">שבועי</SelectItem>
            <SelectItem value="monthly">חודשי</SelectItem>
            <SelectItem value="yearly">שנתי</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>כל</Label>
        <div className="flex items-center gap-2">
          <Input 
            type="number" 
            min="1" 
            value={pattern.interval || 1}
            onChange={handleIntervalChange}
            className="w-20"
          />
          <span>
            {pattern.type === 'daily' && 'ימים'}
            {pattern.type === 'weekly' && 'שבועות'}
            {pattern.type === 'monthly' && 'חודשים'}
            {pattern.type === 'yearly' && 'שנים'}
          </span>
        </div>
      </div>

      {pattern.type === 'weekly' && (
        <div>
          <Label>בימים</Label>
          <ToggleGroup 
            type="multiple" 
            variant="outline"
            value={(pattern.days_of_week || []).map(String)}
            onValueChange={handleDaysOfWeekChange}
            className="flex-wrap"
          >
            <ToggleGroupItem value="1">א</ToggleGroupItem>
            <ToggleGroupItem value="2">ב</ToggleGroupItem>
            <ToggleGroupItem value="3">ג</ToggleGroupItem>
            <ToggleGroupItem value="4">ד</ToggleGroupItem>
            <ToggleGroupItem value="5">ה</ToggleGroupItem>
            <ToggleGroupItem value="6">ו</ToggleGroupItem>
            <ToggleGroupItem value="7">ש</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <div>
        <Label>תאריך סיום (אופציונלי)</Label>
        <Input 
          type="date"
          value={pattern.end_date || ''}
          onChange={(e) => setPattern({...pattern, end_date: e.target.value})}
        />
      </div>
    </div>
  );
}