export function getRandomString(length: number): string {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    array = array.map((x): number => validChars.charCodeAt(x % validChars.length));
    return String.fromCharCode.apply(null, Array.from(array));
}

export function encodeUrlToBase64(url: string): string {
    return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function toUrlParameter(dict: { [name: string]: string }): string {
    const keys = Object.keys(dict);
    const uriEncodedParts: string[] = keys
        .filter((key) => dict[key])
        .map((key): string => `${key}=${encodeURIComponent(dict[key])}`);

    return uriEncodedParts.join('&');
}

export function normalizeDomain(domain: string): string {
    let normalizedDomain = domain.replace(/^(http(?:s)?:\/\/)/, '');
    return normalizedDomain.endsWith('/') ? normalizedDomain.replace(/\/+$/, '') : normalizedDomain;
}

export async function httpCall<JsonResponse>(url: string, init?: RequestInit): Promise<JsonResponse> {
    return fetch(url, init).then(async (response) => {
        if (response.status >= 200 && response.status <= 299) {
            return (await response.json()) as JsonResponse;
        }
        throw new Error(response.statusText);
    }).then((response) => {
        return response;
    }).catch((error) => {
        throw new Error(error);
    });
}

export function addWindowEventListener(eventType: string, callback: any): () => void {
    window.addEventListener(eventType, callback);
    return () => {
        window.removeEventListener(eventType, callback);
    };
}
