export type LogInfo = {
    code: string;
    message: string;
};

export function logMessage(type: string, info: LogInfo): void {
    switch (type) {
        case 'warning':
            console.warn(`${info.code}: ${info.message}`);
            break;
        case 'error':
            console.log(`%c${info.code}:%c ${info.message}`, 'background: red; color: white', 'color: red');
            break;
        default:
            break;
    }
}
