import React from 'react';
import { BarChart3, CheckSquare, CalendarPlus } from 'lucide-react';

interface ActionCardProps {
  type: 'poll' | 'task' | 'calendar';
  label: string;
  onAction: () => void;
}

const actionConfig = {
  poll: { icon: BarChart3, color: 'blue', buttonText: 'Create Poll' },
  task: { icon: CheckSquare, color: 'green', buttonText: 'Add to Tasks' },
  calendar: { icon: CalendarPlus, color: 'purple', buttonText: 'Add to Calendar' },
};

export const ActionCard = ({ type, label, onAction }: ActionCardProps) => {
  const config = actionConfig[type];
  const Icon = config.icon;

  return (
    <div className={`bg-${config.color}-500/10 border border-${config.color}-500/30 rounded-xl p-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={`text-${config.color}-400 flex-shrink-0`} />
          <span className="text-slate-300 text-sm truncate">{label}</span>
        </div>
        <button
          onClick={onAction}
          className={`bg-${config.color}-500/20 hover:bg-${config.color}-500/30 text-${config.color}-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0`}
        >
          {config.buttonText}
        </button>
      </div>
    </div>
  );
};
