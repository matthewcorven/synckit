import { TermsDto } from './registration.types';

export const TERMS_MOCK_DATA: TermsDto = {
  version: 'v1',
  html: `
    <h1>Terms and Conditions</h1>
    <p>By submitting this entry, you agree to follow all trial rules and policies.</p>
    <h2>1. Agreement to Rules</h2>
    <p>Handlers agree to comply with the ASCA Stock Dog Trial rules.</p>
    <h2>2. Liability Waiver</h2>
    <p>Handlers release the host club from liability for loss, injury, or damage.</p>
    <h2>3. Photo/Video Release</h2>
    <p>Handlers grant permission for photos or videos from the event.</p>
  `.trim()
};
