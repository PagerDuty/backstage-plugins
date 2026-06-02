import { FieldErrors } from '../CustomFieldModal';

export const toFieldErrors = (message: string): FieldErrors => {
  const lower = message.toLowerCase();
  if (lower.includes('name') && lower.includes('already exists')) {
    return { name: 'Entered Name matches one already in use. Please make changes to continue.' };
  }
  if (lower.includes('entity path') && lower.includes('already')) {
    return { entityPath: 'Entered Entity Path matches one already in use. Please make changes to continue.' };
  }
  return { general: message };
};
