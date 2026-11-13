import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildWhatsAppChatUrl,
  cleanPhoneInput,
  DEFAULT_WHATSAPP_BUTTON_TEXT,
  DEFAULT_WHATSAPP_NUMBER,
  formatWhatsAppDisplayNumber,
  normalizeWhatsAppSettings,
  sanitizeHexColor,
  toWaMeDigits,
  validateAndNormalizeWhatsAppNumber
} from '../src/utils/whatsappUtils';
import { DEFAULT_WEBSITE_DESIGN, DEFAULT_WHATSAPP_CONTACT } from '../src/types/websiteDesign';

let passed = 0;
let failed = 0;

const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed += 1;
  }
};

// 1. Phone number cleaning & validation
test('validates and normalizes international Rwanda WhatsApp numbers', () => {
  const res = validateAndNormalizeWhatsAppNumber('+250 782 971 258');
  assert.equal(res.valid, true);
  assert.equal(res.normalized, '+250782971258');
  assert.equal(res.waMeDigits, '250782971258');

  const bracketed = validateAndNormalizeWhatsAppNumber('00250 (788) 123-456');
  assert.equal(bracketed.valid, true);
  assert.equal(bracketed.normalized, '+250788123456');
  assert.equal(bracketed.waMeDigits, '250788123456');

  assert.equal(cleanPhoneInput(' +254 (712) 345-678 '), '+254712345678');
});

test('rejects invalid phone numbers or numbers missing country code', () => {
  assert.equal(validateAndNormalizeWhatsAppNumber('').valid, false);
  assert.equal(validateAndNormalizeWhatsAppNumber('0782971258').valid, false);
  assert.equal(validateAndNormalizeWhatsAppNumber('+25078abc').valid, false);
  assert.equal(validateAndNormalizeWhatsAppNumber('+1234').valid, false);
  assert.equal(validateAndNormalizeWhatsAppNumber('+1234567890123456').valid, false);
  assert.equal(validateAndNormalizeWhatsAppNumber('+0250782971258').valid, false);
});

// 2. Link generation & formatting
test('generates valid https://wa.me URLs with and without greeting messages', () => {
  assert.equal(
    buildWhatsAppChatUrl('+250 (782) 971-258', ''),
    'https://wa.me/250782971258'
  );
  assert.equal(
    buildWhatsAppChatUrl('+250 788 000 111', 'Hello GS Gitumba!'),
    'https://wa.me/250788000111?text=Hello%20GS%20Gitumba!'
  );
  assert.equal(buildWhatsAppChatUrl('invalid-num', 'hi'), '');
  assert.equal(toWaMeDigits('+250 782 971 258'), '250782971258');
  assert.equal(formatWhatsAppDisplayNumber('+250782971258'), '+250 782 971 258');
});

// 3. Settings defaults, color sanitization & normalization
test('normalizes partial and customized WhatsApp settings safely', () => {
  const defaults = normalizeWhatsAppSettings();
  assert.deepEqual(defaults, DEFAULT_WHATSAPP_CONTACT);
  assert.equal(defaults.phoneNumber, DEFAULT_WHATSAPP_NUMBER);
  assert.equal(defaults.buttonText, DEFAULT_WHATSAPP_BUTTON_TEXT);
  assert.equal(defaults.enabled, true);

  const custom = normalizeWhatsAppSettings({
    enabled: false,
    phoneNumber: '+250 788 555 222',
    buttonText: 'Chat With Support',
    defaultMessage: 'Muraho!',
    backgroundColor: '#0f766e',
    textColor: '#ffffff',
    position: 'bottom-left',
    size: 'large',
    shape: 'rounded',
    showIcon: false,
    displayMode: 'normal'
  });

  assert.equal(custom.enabled, false);
  assert.equal(custom.phoneNumber, '+250788555222');
  assert.equal(custom.buttonText, 'Chat With Support');
  assert.equal(custom.defaultMessage, 'Muraho!');
  assert.equal(custom.backgroundColor, '#0f766e');
  assert.equal(custom.textColor, '#ffffff');
  assert.equal(custom.position, 'bottom-left');
  assert.equal(custom.size, 'large');
  assert.equal(custom.shape, 'rounded');
  assert.equal(custom.showIcon, false);
  assert.equal(custom.displayMode, 'normal');

  assert.equal(sanitizeHexColor('not-a-color', '#25D366'), '#25D366');
  assert.equal(sanitizeHexColor('#128C7E', '#25D366'), '#128C7E');
  assert.ok(DEFAULT_WEBSITE_DESIGN.whatsappContact);
});

// 4. Wiring and code-hygiene checks across Admin & Public components
test('AdminDashboardView exposes WhatsApp Contact Settings section and avoids hardcoded number', () => {
  const adminSrc = fs.readFileSync(path.resolve('src/views/AdminDashboardView.tsx'), 'utf8');
  assert.match(adminSrc, /WhatsApp Contact Settings/);
  assert.match(adminSrc, /<AdminWhatsAppSettings\s*\/>/);
  assert.doesNotMatch(adminSrc, /0782971258/);
});

test('AdminWhatsAppSettings enforces admin auth, validation, customization, and live preview', () => {
  const compSrc = fs.readFileSync(path.resolve('src/components/AdminWhatsAppSettings.tsx'), 'utf8');
  assert.match(compSrc, /if \(!isAdmin\)/);
  assert.match(compSrc, /validateAndNormalizeWhatsAppNumber/);
  assert.match(compSrc, /saveWhatsAppContactSettings/);
  assert.match(compSrc, /Live Preview/);
  assert.match(compSrc, /WhatsAppButtonView/);
  assert.match(compSrc, /displayMode/);
  assert.match(compSrc, /showIcon/);
  assert.match(compSrc, /backgroundColor/);
  assert.match(compSrc, /textColor/);
});

test('WhatsAppFloatingButton and analyticsService consume dynamic settings without hardcoded phone', () => {
  const btnSrc = fs.readFileSync(path.resolve('src/components/WhatsAppFloatingButton.tsx'), 'utf8');
  assert.match(btnSrc, /useWebsiteDesign/);
  assert.match(btnSrc, /if \(!whatsappContact \|\| !whatsappContact\.enabled\)/);
  assert.match(btnSrc, /buildWhatsAppChatUrl/);
  assert.doesNotMatch(btnSrc, /250782971258/);
  assert.doesNotMatch(btnSrc, /0782971258/);

  const analyticsSrc = fs.readFileSync(path.resolve('src/services/analyticsService.ts'), 'utf8');
  assert.doesNotMatch(analyticsSrc, /'250782971258'/);
  assert.doesNotMatch(analyticsSrc, /0782971258/);
});

test('WebsiteDesignContext and websiteDesignService persist and restore whatsappContact', () => {
  const ctxSrc = fs.readFileSync(path.resolve('src/context/WebsiteDesignContext.tsx'), 'utf8');
  assert.match(ctxSrc, /saveWhatsAppContactSettings/);
  assert.match(ctxSrc, /whatsappContact: normalizeWhatsAppSettings/);

  const svcSrc = fs.readFileSync(path.resolve('src/services/websiteDesignService.ts'), 'utf8');
  assert.match(svcSrc, /whatsappContact: normalizeWhatsAppSettings/);
});

console.log(`\nWhatsApp Settings Verification: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
