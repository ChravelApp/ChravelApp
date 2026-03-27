import React from "react";
import { BarChart3, CheckSquare, CalendarPlus } from "lucide-react";

interface ActionCardProps {
  type: "poll" | "task" | "calendar";
  label: string;
  onAction: () => void;
}

const actionConfig = {
  poll: {
    icon: BarChart3,
    buttonText: "Create Poll",
    containerClassName: "bg-blue-500/10 border border-blue-500/30",
    iconClassName: "text-blue-400",
    buttonClassName: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300",
  },
  task: {
    icon: CheckSquare,
    buttonText: "Add to Tasks",
    containerClassName: "bg-green-500/10 border border-green-500/30",
    iconClassName: "text-green-400",
    buttonClassName: "bg-green-500/20 hover:bg-green-500/30 text-green-300",
  },
  calendar: {
    icon: CalendarPlus,
    buttonText: "Add to Calendar",
    containerClassName: "bg-purple-500/10 border border-purple-500/30",
    iconClassName: "text-purple-400",
    buttonClassName: "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300",
  },
};

export const ActionCard = ({ type, label, onAction }: ActionCardProps) => {
  const config = actionConfig[type];
  const Icon = config.icon;

  return (
    <div className={`${config.containerClassName} rounded-xl p-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={`${config.iconClassName} flex-shrink-0`} />
          <span className="text-slate-300 text-sm truncate">{label}</span>
        </div>
        <button
          onClick={onAction}
          className={`${config.buttonClassName} text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0`}
        >
          {config.buttonText}
        </button>
      </div>
    </div>
  );
};
