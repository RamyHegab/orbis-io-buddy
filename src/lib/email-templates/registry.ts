import type { ComponentType } from 'react'
import { template as tripSubmittedForApproval } from './trip-submitted-for-approval'
import { template as tripApproved } from './trip-approved'
import { template as tripChangesRequested } from './trip-changes-requested'
import { template as planningItineraryReminder } from './planning-itinerary-reminder'
import { template as planningActualCostsReminder } from './planning-actual-costs-reminder'
import { template as checklistReminder } from './checklist-reminder'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'trip-submitted-for-approval': tripSubmittedForApproval,
  'trip-approved': tripApproved,
  'trip-changes-requested': tripChangesRequested,
  'planning-itinerary-reminder': planningItineraryReminder,
  'planning-actual-costs-reminder': planningActualCostsReminder,
  'checklist-reminder': checklistReminder,
}
