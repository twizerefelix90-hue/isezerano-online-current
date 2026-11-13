import {
  DEFAULT_WHATSAPP_CONTACT,
  WhatsAppButtonDisplayMode,
  WhatsAppButtonPosition,
  WhatsAppButtonShape,
  WhatsAppButtonSize,
  WhatsAppContactSettings
} from '../utils/whatsappSettingsTypes';

export const DEFAULT_WHATSAPP_NUMBER = '+250782971258';
export const DEFAULT_WHATSAPP_BUTTON_TEXT = 'Twandikire kuri WhatsApp';
export const DEFAULT_WHATSAPP_MESSAGE =
  'Muraho! Ndifuza kumenya byinshi kuri serivisi za ISEZERANO ONLINE – GS GITUMBA.';

export interface WhatsAppValidationResult {
  valid: boolean;
  normalized: string;
  waMeDigits: string;
  error?: string;
}

/**
 * Strips whitespace, dashes, brackets, and dots from a phone input,
 * converting a leading `00` international prefix into `+`.
 */
export const cleanPhoneInput = (raw: string): string => {
  const compact = (raw || '').trim().replace(/[\s\-().]/g, '');
  if (compact.startsWith('00')) {
    return `+${compact.slice(2)}`;
  }
  return compact;
};

/**
 * Validates and normalizes an international WhatsApp phone number (E.164 format).
 * Example valid inputs: "+250782971258", "+250 782 971 258", "00250 (782) 971-258".
 */
export const validateAndNormalizeWhatsAppNumber = (rawInput: string): WhatsAppValidationResult => {
  const cleaned = cleanPhoneInput(rawInput);

  if (!cleaned) {
    return {
      valid: false,
      normalized: '',
      waMeDigits: '',
      error: 'WhatsApp phone number is required. Include country code (e.g. +250782971258).'
    };
  }

  // Reject characters other than an optional leading '+' and digits
  if (!/^\+?\d+$/.test(cleaned)) {
    return {
      valid: false,
      normalized: '',
      waMeDigits: '',
      error: 'Phone number can only contain digits, spaces, brackets, dashes, and a leading + country code.'
    };
  }

  // Require international country code (do not allow local numbers starting with single 0)
  if (!cleaned.startsWith('+') && cleaned.startsWith('0')) {
    return {
      valid: false,
      normalized: '',
      waMeDigits: '',
      error: 'Include the international country code with + (for example: +250782971258 instead of 0782971258).'
    };
  }

  const digits = cleaned.replace(/\D/g, '');

  if (digits.length < 8 || digits.length > 15) {
    return {
      valid: false,
      normalized: '',
      waMeDigits: '',
      error: 'Phone number must have between 8 and 15 digits including the country code (e.g. +250782971258).'
    };
  }

  if (digits.startsWith('0')) {
    return {
      valid: false,
      normalized: '',
      waMeDigits: '',
      error: 'Country code cannot start with 0. Example: +250782971258.'
    };
  }

  return {
    valid: true,
    normalized: `+${digits}`,
    waMeDigits: digits
  };
};

/**
 * Extracts only the digits required by https://wa.me/<digits>
 */
export const toWaMeDigits = (phoneNumber: string): string => {
  const validation = validateAndNormalizeWhatsAppNumber(phoneNumber);
  return validation.valid ? validation.waMeDigits : '';
};

/**
 * Generates the official WhatsApp click-to-chat URL:
 * https://wa.me/<digits> or https://wa.me/<digits>?text=<encoded>
 */
export const buildWhatsAppChatUrl = (phoneNumber: string, defaultMessage?: string): string => {
  const digits = toWaMeDigits(phoneNumber);
  if (!digits) return '';

  const base = `https://wa.me/${digits}`;
  const trimmedMsg = (defaultMessage || '').trim();
  if (!trimmedMsg) return base;

  return `${base}?text=${encodeURIComponent(trimmedMsg)}`;
};

/**
 * Formats an international WhatsApp number for human-readable display.
 */
export const formatWhatsAppDisplayNumber = (phoneNumber: string): string => {
  const validation = validateAndNormalizeWhatsAppNumber(phoneNumber);
  if (!validation.valid) return phoneNumber || DEFAULT_WHATSAPP_NUMBER;
  const { normalized, waMeDigits } = validation;
  if (waMeDigits.startsWith('250') && waMeDigits.length === 12) {
    return `+250 ${waMeDigits.slice(3, 6)} ${waMeDigits.slice(6, 9)} ${waMeDigits.slice(9, 12)}`;
  }
  return normalized;
};

/**
 * Validates and sanitizes a CSS hex color string.
 */
export const sanitizeHexColor = (value: string | undefined, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
};

const VALID_POSITIONS: WhatsAppButtonPosition[] = ['bottom-right', 'bottom-left'];
const VALID_SIZES: WhatsAppButtonSize[] = ['small', 'medium', 'large'];
const VALID_SHAPES: WhatsAppButtonShape[] = ['rounded', 'pill'];
const VALID_DISPLAY_MODES: WhatsAppButtonDisplayMode[] = ['floating', 'normal'];

/**
 * Safely merges partial or legacy WhatsApp settings with guaranteed valid defaults.
 */
export const normalizeWhatsAppSettings = (
  raw?: Partial<WhatsAppContactSettings> | null
): WhatsAppContactSettings => {
  const source = raw || {};
  const numberCheck = validateAndNormalizeWhatsAppNumber(source.phoneNumber || '');

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_WHATSAPP_CONTACT.enabled,
    phoneNumber: numberCheck.valid ? numberCheck.normalized : DEFAULT_WHATSAPP_CONTACT.phoneNumber,
    buttonText:
      typeof source.buttonText === 'string' && source.buttonText.trim().length > 0
        ? source.buttonText.trim()
        : DEFAULT_WHATSAPP_CONTACT.buttonText,
    defaultMessage:
      typeof source.defaultMessage === 'string'
        ? source.defaultMessage
        : DEFAULT_WHATSAPP_CONTACT.defaultMessage,
    backgroundColor: sanitizeHexColor(source.backgroundColor, DEFAULT_WHATSAPP_CONTACT.backgroundColor),
    textColor: sanitizeHexColor(source.textColor, DEFAULT_WHATSAPP_CONTACT.textColor),
    position: VALID_POSITIONS.includes(source.position as WhatsAppButtonPosition)
      ? (source.position as WhatsAppButtonPosition)
      : DEFAULT_WHATSAPP_CONTACT.position,
    size: VALID_SIZES.includes(source.size as WhatsAppButtonSize)
      ? (source.size as WhatsAppButtonSize)
      : DEFAULT_WHATSAPP_CONTACT.size,
    shape: VALID_SHAPES.includes(source.shape as WhatsAppButtonShape)
      ? (source.shape as WhatsAppButtonShape)
      : DEFAULT_WHATSAPP_CONTACT.shape,
    showIcon: typeof source.showIcon === 'boolean' ? source.showIcon : DEFAULT_WHATSAPP_CONTACT.showIcon,
    displayMode: VALID_DISPLAY_MODES.includes(source.displayMode as WhatsAppButtonDisplayMode)
      ? (source.displayMode as WhatsAppButtonDisplayMode)
      : DEFAULT_WHATSAPP_CONTACT.displayMode
  };
};
