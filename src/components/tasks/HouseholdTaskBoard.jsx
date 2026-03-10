import React from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import HouseholdTaskCard from './HouseholdTaskCard';

export default function HouseholdTaskBoard({ tasks, onDragEnd, onStatusChange, onAssign, onTaskClick, onEdit, onDelete }) {
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="householdTasks">
                {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                        {tasks.map((task, index) => (
                            <HouseholdTaskCard
                                key={task.id}
                                task={task}
                                index={index}
                                onStatusChange={onStatusChange}
                                onAssign={onAssign}
                                onClick={onTaskClick}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}