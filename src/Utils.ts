export function getRandomString(length: number): string {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    array = array.map((x): number => validChars.charCodeAt(x % validChars.length));
    return String.fromCharCode.apply(null, Array.from(array));
}

export function encodeUrlToBase64(url: string): string {
    return btoa(url)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export function toUrlParameter(dict: { [name: string]: string }): string {
    const keys = Object.keys(dict);
    const uriEncodedParts: Array<string> = keys
        .filter(key => dict[key])
        .map((key): string => `${key}=${encodeURIComponent(dict[key])}`);

    return uriEncodedParts.join('&');
}

export function normalizeDomain(domain: string): string {
    const normalizedDomain = domain.replace(/^(http(?:s)?:\/\/)/, '')
    if (normalizedDomain.endsWith('/')) {
        return normalizedDomain.replace(/\/+$/, '');
    }
    return normalizedDomain;
}

export async function httpCall<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (response.status >= 200 && response.status <= 299) {
        return await response.json() as T;
    }
    throw new Error(response.statusText)
}

export function addWindowEventListener(eventType: string, callback: any): Function {
    window.addEventListener(eventType, callback);
    return () => {
        window.removeEventListener(eventType, callback);
    }
}