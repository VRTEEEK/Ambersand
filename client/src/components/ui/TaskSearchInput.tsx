import { Search } from "lucide-react";

interface TaskSearchInputProps {
  value: string; 
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function TaskSearchInput({ 
  value, 
  onChange, 
  placeholder = "Search tasks...",
  className = ""
}: TaskSearchInputProps) {
  return (
    <div className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className || "w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm transition-all hover:shadow-md"}
      />
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  );
}