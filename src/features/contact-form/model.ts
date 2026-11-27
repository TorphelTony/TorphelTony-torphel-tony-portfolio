export interface Inquiry {
  fullName: string;
  email: string;
  dialCode: string;
  phone: string;
  company: string;
  website: string;
  projectType: string;
  budget: string;
  projectBrief: string;
  preferredDate: string;
  preferredTime: string;
  timezone: string;
  startedAt: number;
  website_check: string;
  recaptchaToken: string;
}

export const limits: Record<
  keyof Pick<Inquiry, 'fullName' | 'email' | 'phone' | 'company' | 'website' | 'projectBrief'>,
  number
> = {
  fullName: 100,
  email: 254,
  phone: 24,
  company: 100,
  website: 200,
  projectBrief: 2000,
};

export function validateInquiry(data: Inquiry): Record<string, string> {
  const errors: Record<string, string> = {};
  const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
  if (text(data.fullName).length < 2 || text(data.fullName).length > limits.fullName)
    errors.fullName = 'Please enter your name.';
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text(data.email)) ||
    text(data.email).length > limits.email
  )
    errors.email = 'Enter a valid email address.';
  if (!/^\+\d{1,4}$/.test(text(data.dialCode))) errors.dialCode = 'Select a country code.';
  if (
    !/^[\d\s()+.-]{7,24}$/.test(text(data.phone)) ||
    text(data.phone).replace(/\D/g, '').length < 7
  )
    errors.phone = 'Enter a valid phone number.';
  if (text(data.company).length > limits.company) errors.company = 'Company name is too long.';
  if (text(data.website).length > limits.website)
    errors.website = 'Website or Instagram is too long.';
  if (
    !['Web application', 'Angular architecture', 'AI integration', 'Consulting', 'Other'].includes(
      text(data.projectType),
    )
  )
    errors.projectType = 'Select a project type.';
  if (
    !['Under $2,000', '$2,000–$5,000', '$5,000–$10,000', '$10,000+', 'Let’s discuss'].includes(
      text(data.budget),
    )
  )
    errors.budget = 'Select a budget range.';
  if (text(data.projectBrief).length < 20 || text(data.projectBrief).length > limits.projectBrief)
    errors.projectBrief = 'Please add at least 20 characters about your project.';
  const date = text(data.preferredDate);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    errors.preferredDate = 'Choose a valid date.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text(data.preferredTime)))
    errors.preferredTime = 'Choose a valid time.';
  try {
    if (!text(data.timezone) || text(data.timezone).length > 80) throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: data.timezone }).format();
  } catch {
    errors.timezone = 'Invalid time zone.';
  }
  return errors;
}
