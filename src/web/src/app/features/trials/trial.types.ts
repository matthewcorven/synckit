export interface FormTemplateKey {
  organizationCode: string;
  sportCode: string;
  formCode: string;
  version: string;
}

export interface TrialSummaryDto {
  trialId: string;
  name: string;
  organizationName: string;
  sportName: string;
  formName: string;
  formTemplate: FormTemplateKey;
  organizerSlug: string;
  eventSlug: string;
  trackingSlug: string;
  hostClub: string;
  startDate: string;
  endDate: string;
  location?: string | null;
  secretaryEmail: string;
  isActive: boolean;
}
