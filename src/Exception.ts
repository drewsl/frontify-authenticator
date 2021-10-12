import { logMessage } from './Logger';

export class AuthenticatorError extends Error {
    constructor(public code: string, message: string) {
        super(`${code}: ${message}`);
        logMessage('error', {
            code: code,
            message: message,
        });
    }
}
