/**
 * Normalize text by trimming and collapsing multiple spaces
 */
export function normalizeText(text?: string | null): string {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Check if a control matches a search query
 */
export function matchesQuery(control: any, query: string, language: 'en' | 'ar'): boolean {
  if (!query.trim()) return true;
  
  const searchTerm = query.toLowerCase().trim();
  const fields = [
    control.clauseNumber,
    language === 'ar' ? control.controlAr : control.controlEn,
    language === 'ar' ? control.descriptionAr : control.descriptionEn,
    control.controlEn, // Always search English too
    control.descriptionEn // Always search English too
  ];
  
  return fields.some(field => 
    field && normalizeText(field).toLowerCase().includes(searchTerm)
  );
}

/**
 * Get the display text for a domain based on language preference
 */
export function getDomainLabel(domain: any, language: 'en' | 'ar'): string {
  if (language === 'ar' && domain.domainAr) {
    return domain.domainAr;
  }
  return domain.domainEn || domain.domainAr || 'Unknown Domain';
}

/**
 * Group controls by domain
 */
export function groupControlsByDomain(controls: any[], language: 'en' | 'ar'): Map<string, { label: string; controls: any[] }> {
  const groups = new Map<string, { label: string; controls: any[] }>();
  
  for (const control of controls) {
    const domainKey = normalizeText(
      language === 'ar' ? control.domainAr : control.domainEn
    ).toLowerCase() || 'uncategorized';
    
    const displayLabel = getDomainLabel(control, language);
    
    if (!groups.has(domainKey)) {
      groups.set(domainKey, { 
        label: displayLabel, 
        controls: [] 
      });
    }
    
    groups.get(domainKey)!.controls.push(control);
  }
  
  return groups;
}