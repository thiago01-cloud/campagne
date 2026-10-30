// Common connector: the app only talks to this interface. Plugging in a
// real provider = adding an implementation and declaring it in index.ts.
export type SendResult = { providerId: string };

export interface SmsProvider {
  name: string;
  sendSms(phone: string, message: string): Promise<SendResult>;
}

export interface EmailProvider {
  name: string;
  sendEmail(address: string, subject: string, content: { html: string; text: string }, sender?: string | null): Promise<SendResult>;
}

/** Error that must not be retried (number refused, address rejected…) */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}
