// The public half of the key that seals the email of visitors who offer to
// help with their report (see src/feedback.ts). Written by
// `npm run contact-key`; the private half stays on the maintainer's computer
// in .keys/ and never enters the repository. While this is null the offer to
// help is hidden.

export const CONTACT_KEY: { id: string; spki: string } | null = null;
