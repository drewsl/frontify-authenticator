export type LogInfo = {
    code: string;
    message: string;
};

export function logMessage(type: string, info: LogInfo) {
    switch (type) {
        case 'warning':
            console.warn(info.message);
            break;
        case 'error':
            throw new Error(info.message);
    }
}
