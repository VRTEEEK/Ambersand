import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface AnalyticsFilters {
  projectIds: number[];
  regulationIds: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

interface FilterSelectorProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  className?: string;
}

export function FilterSelector({ filters, onFiltersChange, className }: FilterSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch available projects
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  // Define available regulations
  const regulations = [
    { id: 'ecc', name: 'Essential Cybersecurity Controls (ECC)', nameAr: 'الضوابط الأساسية للأمن السيبراني' },
    { id: 'pdpl', name: 'Personal Data Protection Law (PDPL)', nameAr: 'نظام حماية البيانات الشخصية' },
    { id: 'ndmo', name: 'National Data Management Office (NDMO)', nameAr: 'المكتب الوطني لإدارة البيانات' },
  ];

  const handleProjectToggle = (projectId: number) => {
    const newProjectIds = filters.projectIds.includes(projectId)
      ? filters.projectIds.filter(id => id !== projectId)
      : [...filters.projectIds, projectId];
    
    onFiltersChange({ ...filters, projectIds: newProjectIds });
  };

  const handleRegulationToggle = (regulationId: string) => {
    const newRegulationIds = filters.regulationIds.includes(regulationId)
      ? filters.regulationIds.filter(id => id !== regulationId)
      : [...filters.regulationIds, regulationId];
    
    onFiltersChange({ ...filters, regulationIds: newRegulationIds });
  };

  const handleDateFromChange = (date: Date | undefined) => {
    onFiltersChange({ ...filters, dateFrom: date });
  };

  const handleDateToChange = (date: Date | undefined) => {
    onFiltersChange({ ...filters, dateTo: date });
  };

  const clearFilters = () => {
    onFiltersChange({
      projectIds: [],
      regulationIds: [],
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasActiveFilters = filters.projectIds.length > 0 || 
                          filters.regulationIds.length > 0 || 
                          filters.dateFrom || 
                          filters.dateTo;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("gap-2", className)}
          size="sm"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
              {filters.projectIds.length + filters.regulationIds.length + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filter Analytics</h4>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>

          <Separator />

          {/* Projects Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Projects</Label>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {projects.map((project: any) => (
                  <div key={project.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`project-${project.id}`}
                      checked={filters.projectIds.includes(project.id)}
                      onCheckedChange={() => handleProjectToggle(project.id)}
                    />
                    <Label
                      htmlFor={`project-${project.id}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {project.name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Regulations Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Regulations</Label>
            <div className="space-y-2">
              {regulations.map((regulation) => (
                <div key={regulation.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`regulation-${regulation.id}`}
                    checked={filters.regulationIds.includes(regulation.id)}
                    onCheckedChange={() => handleRegulationToggle(regulation.id)}
                  />
                  <Label
                    htmlFor={`regulation-${regulation.id}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {regulation.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dateFrom && "text-muted-foreground"
                      )}
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(filters.dateFrom, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={handleDateFromChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dateTo && "text-muted-foreground"
                      )}
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(filters.dateTo, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={handleDateToChange}
                      disabled={(date) => {
                        const today = new Date();
                        const minDate = new Date("1900-01-01");
                        if (date > today || date < minDate) return true;
                        if (filters.dateFrom && date < filters.dateFrom) return true;
                        return false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}