
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Zap, Brain, ShieldAlert, Users, Repeat, Pencil, Trash2 } from 'lucide-react';

const categoryColors = {
    cleaning: 'border-l-4 border-cyan-500 bg-cyan-50',
    kitchen: 'border-l-4 border-orange-500 bg-orange-50',
    laundry: 'border-l-4 border-blue-500 bg-blue-50',
    shopping: 'border-l-4 border-amber-500 bg-amber-50',
    garden: 'border-l-4 border-green-500 bg-green-50',
    caregiving: 'border-l-4 border-rose-500 bg-rose-50',
    maintenance: 'border-l-4 border-gray-500 bg-gray-50',
    errands: 'border-l-4 border-indigo-500 bg-indigo-50',
    family: 'border-l-4 border-pink-500 bg-pink-50',
    personal: 'border-l-4 border-purple-500 bg-purple-50',
    health: 'border-l-4 border-teal-500 bg-teal-50',
    default: 'border-l-4 border-gray-300 bg-gray-50'
};

const categoryIcons = {
    cleaning: "🧹",
    kitchen: "🍳",
    laundry: "🧺",
    shopping: "🛒",
    garden: "🌱",
    caregiving: "❤️",
    maintenance: "🔧",
    errands: "🏃‍♀️",
    family: "👨‍👩‍👧‍👦",
    personal: "🧘‍♀️",
    health: "🏥",
    default: "📝"
};

const roleDisplayName = {
    parent: "הורה",
    teen16: "נער/ה 16",
    teen14: "נער/ה 14",
    anyone: "כולם"
};

export default function HouseholdTaskCard({ task, index, onStatusChange, onAssign, onClick, onEdit, onDelete }) {
    if (!task) return null;

    const getMainCategory = (category) => {
        if (!category) return 'default';
        const parts = category.split('_');
        return parts.length > 1 ? parts[1] : parts[0];
    };

    const mainCategory = getMainCategory(task.category);
    const cardColorClass = categoryColors[mainCategory] || categoryColors.default;
    const categoryIcon = categoryIcons[mainCategory] || categoryIcons.default;
    const isCompleted = task.status === 'completed';

    const handleCardClick = (e) => {
        // Prevent click when interacting with checkbox or button
        if (e.target.closest('button, [type="checkbox"]')) {
            return;
        }
        onClick(task);
    };

    return (
        <Draggable draggableId={task.id.toString()} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`mb-3 transition-shadow duration-200 ${snapshot.isDragging ? 'shadow-2xl scale-105' : 'shadow-md'} cursor-pointer`}
                    onClick={handleCardClick}
                >
                    <Card className={`overflow-hidden ${cardColorClass} ${isCompleted ? 'opacity-60' : ''}`}>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-3 flex-grow">
                                    <Checkbox
                                        id={`task-${task.id}`}
                                        checked={isCompleted}
                                        onCheckedChange={(checked) => onStatusChange(task, checked ? 'completed' : 'not_started')}
                                        className="w-6 h-6"
                                    />
                                    <span className="text-2xl">{categoryIcon}</span>
                                    <h3 className={`text-lg font-semibold text-gray-800 ${isCompleted ? 'line-through' : ''}`}>{task.title}</h3>
                                </div>
                                {task.is_recurring && (
                                    <Badge variant="outline" className="flex items-center gap-1 flex-shrink-0">
                                        <Repeat className="w-3 h-3" />
                                        <span>חוזרת</span>
                                    </Badge>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm text-gray-600 pl-11">
                                <div className="flex items-center gap-1.5" title="זמן מוערך">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    <span>{task.estimated_duration || 'N/A'} דקות</span>
                                </div>
                                <div className="flex items-center gap-1.5" title="רמת אנרגיה נדרשת">
                                    <Zap className="w-4 h-4 text-orange-500" />
                                    <span className="capitalize">{task.energy_level || 'בינונית'}</span>
                                </div>
                                <div className="flex items-center gap-1.5" title="קטגוריה">
                                    <Badge variant="outline">{task.category}</Badge>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center pl-11">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">מתאים ל:</span>
                                    {(task.suitable_for || []).map(person => (
                                        <Badge key={person} variant="secondary">
                                            {roleDisplayName[person] || person}
                                        </Badge>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    {onEdit && (
                                        <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="עריכת משימה">
                                            <Pencil className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(task); }} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="מחק משימה">
                                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                                        </button>
                                    )}
                                    <Button onClick={() => onAssign(task)} size="sm" className="bg-primary hover:bg-primary/90 text-white">
                                        <Users className="w-4 h-4 ml-2" />
                                        הקצה למישהו
                                    </Button>
                                </div>
                            </div>

                            {task.safety && (
                                <div className="flex items-center gap-2 p-2 bg-yellow-50 border-r-4 border-yellow-400 text-yellow-800 text-sm mt-2">
                                    <ShieldAlert className="w-5 h-5" />
                                    <span>{task.safety}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </Draggable>
    );
}
