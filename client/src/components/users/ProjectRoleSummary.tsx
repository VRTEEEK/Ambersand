import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/hooks/use-i18n';

interface ProjectRole {
  projectId: string;
  projectName: string;
  roles: { code: string; name?: string }[];
}

interface ProjectRoleSummaryProps {
  roles?: ProjectRole[];
}

export default function ProjectRoleSummary({ roles = [] }: ProjectRoleSummaryProps) {
  const { t } = useI18n();
  
  const getRoleDisplayName = (roleCode: string) => {
    const roleNames = {
      'admin': t('roles.admin'),
      'user': t('roles.user'),
      'officer': t('roles.officer'), 
      'collaborator': t('roles.collaborator'),
      'viewer': t('roles.viewer')
    };
    return roleNames[roleCode as keyof typeof roleNames] || roleCode;
  };

  if (!roles || roles.length === 0) {
    return <span className="text-slate-400 text-sm">—</span>;
  }

  const firstTwo = roles.slice(0, 2);
  const rest = roles.slice(2);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {firstTwo.map((pr) => (
        <span key={pr.projectId} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full px-2 py-1">
          {pr.projectName}: {pr.roles.map(r => getRoleDisplayName(r.code)).join(', ')}
        </span>
      ))}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Badge variant="outline" className="text-xs cursor-pointer">+{rest.length}</Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {rest.map((pr) => (
              <div key={pr.projectId} className="px-2 py-1.5 text-xs">
                <div className="font-medium">{pr.projectName}</div>
                <div className="text-slate-600 dark:text-slate-400">
                  {pr.roles.map(r => getRoleDisplayName(r.code)).join(', ')}
                </div>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}