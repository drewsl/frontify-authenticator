export type LogInfo = {
    code: string;
    message: string;
    error?: any;
};

const disabledLogs: {
    warnings: boolean;
    errors: boolean;
} = {
    warnings: true,
    errors: false,
};

export function logMessage(type: string, info: LogInfo): void {
    switch (type) {
        case 'warning':
            if (!disabledLogs.warnings) {
                console.warn(`${info.code}: ${info.message}`);
            }
            break;
        case 'error':
            if (!disabledLogs.errors) {
                console.error(`${info.code}: ${info.message}`, info.error || '');
            }
            break;
        default:
            break;
    }
}
