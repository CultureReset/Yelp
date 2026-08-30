export const MAX_REPLY_LENGTH = 5000;

export const REPORT_REASONS = [
  { value: 'conflict_of_interest', label: 'Conflict of interest',
    hint: 'Posted by a competitor, a former employee, or someone with a personal stake.' },
  { value: 'not_a_customer', label: 'Not a real customer',
    hint: 'The reviewer never visited or transacted with this business.' },
  { value: 'personal_attack', label: 'Threat, lewdness, or hate speech',
    hint: 'Attacks a person rather than describing an experience.' },
  { value: 'privacy', label: 'Privacy violation',
    hint: 'Names a staff member, or includes personal or medical details.' },
  { value: 'irrelevant', label: 'Not about this experience',
    hint: 'Commentary unrelated to a customer experience at this business.' },
  { value: 'wrong_business', label: 'Meant for a different business',
    hint: 'Describes somewhere else entirely.' },
  { value: 'inappropriate', label: 'Inappropriate content',
    hint: 'Explicit material, or promotional spam.' },
] as const;

export interface ReplyState { error?: string; ok?: boolean }
