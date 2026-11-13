export type WhatsAppButtonPosition = 'bottom-right' | 'bottom-left';
export type WhatsAppButtonSize = 'small' | 'medium' | 'large';
export type WhatsAppButtonShape = 'rounded' | 'pill';
export type WhatsAppButtonDisplayMode = 'floating' | 'normal';

export interface WhatsAppContactSettings {
  enabled: boolean;
  phoneNumber: string;
  buttonText: string;
  defaultMessage: string;
  backgroundColor: string;
  textColor: string;
  position: WhatsAppButtonPosition;
  size: WhatsAppButtonSize;
  shape: WhatsAppButtonShape;
  showIcon: boolean;
  displayMode: WhatsAppButtonDisplayMode;
}

export const DEFAULT_WHATSAPP_CONTACT: WhatsAppContactSettings = {
  enabled: true,
  phoneNumber: '+250782971258',
  buttonText: 'Twandikire kuri WhatsApp',
  defaultMessage: 'Muraho! Ndifuza kumenya byinshi kuri serivisi za ISEZERANO ONLINE – GS GITUMBA.',
  backgroundColor: '#25D366',
  textColor: '#ffffff',
  position: 'bottom-right',
  size: 'medium',
  shape: 'pill',
  showIcon: true,
  displayMode: 'floating'
};
