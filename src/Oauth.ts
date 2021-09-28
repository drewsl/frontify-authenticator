import { encodeUrlToBase64, getRandomString, toUrlParameter, httpCall, normalizeDomain } from './Utils';
import { logMessage } from './Logger';

const CODE_VERIFIER_LENGTH: number = 64;
const AUTH_URL_RESPONSE_TYPE: string = 'code';
const AUTH_URL_CODE_CHALLENGE_METHOD: string = 'S256';
const AUTH_DEFAULT_REDIRECT_URL: string = '/connection/authenticator';
const AUTH_CODE_GRANT_TYPE: string = 'authorization_code';
const REFRESH_TOKEN_GRANT_TYPE: string = 'refresh_token';
const HASH_ALGORITHM: string = 'SHA-256';
const BEARER_TOKEN_TYPE: string = 'Bearer';

export type AuthenticationConfig = {
    domain?: string;
    clientId: string;
    scopes: string[];
};

export type AuthorizationUrl = {
    authorizationUrl: string;
    codeVerifier: string;
    sessionId: string;
};

export type Token = {
    bearerToken: {
        tokenType: string;
        expiresIn: number;
        accessToken: string;
        refreshToken: string;
        domain: string;
    };
    clientId: string;
    scopes: string[];
};

async function computeChallengeCode(codeVerifier: string): Promise<string> {
    const array: Uint8Array = new TextEncoder().encode(codeVerifier);
    const digest: ArrayBuffer = await window.crypto.subtle.digest(HASH_ALGORITHM, array);
    const hash: string = String.fromCharCode.apply(null, Array.from(new Uint8Array(digest)));
    return encodeUrlToBase64(hash);
}

export async function computeAuthorizationUrl(config: AuthenticationConfig): Promise<AuthorizationUrl> {

    if (!config.domain) {
        throw new Error('No domain provided!');
    }

    try {
        const codeVerifier: string = getRandomString(CODE_VERIFIER_LENGTH);
        const codeChallenge: string = await computeChallengeCode(codeVerifier);
        const sessionId: string = await initializeOauthSession(config.domain);

        return {
            authorizationUrl: `https://${normalizeDomain(config.domain)}/api/oauth/authorize?${toUrlParameter(
                {
                    response_type: AUTH_URL_RESPONSE_TYPE,
                    client_id: config.clientId,
                    scope: config.scopes.join('+'),
                    code_challenge: codeChallenge,
                    code_challenge_method: AUTH_URL_CODE_CHALLENGE_METHOD,
                    redirect_uri: AUTH_DEFAULT_REDIRECT_URL,
                    session_id: sessionId,
                },
            )}`,
            codeVerifier,
            sessionId,
        };
    } catch (error) {
        const errorMessage: string = 'Error computing authorization url.';
        logMessage('error', {
            code: 'ERR_COMPUTE_AUTH_URL',
            message: errorMessage,
        });
        throw new Error(errorMessage);
    }
}

export async function initializeOauthSession(domain: string): Promise<string> {
    try {
        const session = await httpCall<{ data: { key: string } }>(
            `https://${normalizeDomain(domain)}/api/oauth/create/session`,
            { method: 'POST' },
        ).catch((error) => {
            logMessage('error', {
                code: 'ERR_SESSION',
                message: 'Error generating session.',
            });
            throw new Error(error);
        });

        return session.data.key;
    } catch (error) {
        const errorMessage: string = 'Error generating session.';
        logMessage('error', {
            code: 'ERR_SESSION',
            message: errorMessage,
        });
        throw new Error(errorMessage);
    }
}

export async function pollOauthSession(config: AuthenticationConfig, sessionId: string): Promise<string> {

    if (!config.domain) {
        throw new Error('No domain provided!');
    }

    try {
        const response = await httpCall<{ data: { payload: { code: string } } }>(
            `https://${normalizeDomain(config.domain)}/api/oauth/poll`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                }),
            },
        );

        return response.data.payload.code;
    } catch (error) {
        const errorMessage: string = 'Error polling session.';
        logMessage('error', {
            code: 'ERR_POLL_SESSION',
            message: 'Error polling session.',
        });
        throw new Error(errorMessage);
    }
}

export async function retrieveAccessToken(
    config: AuthenticationConfig,
    code: string,
    codeVerifier: string,
): Promise<Token> {

    if (!config.domain) {
        throw new Error('No domain provided!');
    }

    try {
        const normalizedDomain = normalizeDomain(config.domain);
        const response = await httpCall<{ access_token: string; expires_in: number; refresh_token: string }>(
            `https://${normalizedDomain}/api/oauth/accesstoken`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    grant_type: AUTH_CODE_GRANT_TYPE,
                    code,
                    code_verifier: codeVerifier,
                    client_id: config.clientId,
                    redirect_uri: AUTH_DEFAULT_REDIRECT_URL,
                }),
            },
        );

        return {
            bearerToken: {
                tokenType: BEARER_TOKEN_TYPE,
                expiresIn: response.expires_in,
                accessToken: response.access_token,
                refreshToken: response.refresh_token,
                domain: normalizedDomain,
            },
            clientId: config.clientId,
            scopes: config.scopes,
        };
    } catch (error) {
        const errorMessage: string = 'Error retrieving token.';
        logMessage('error', {
            code: 'ERR_ACCESS_TOKEN',
            message: 'errorMessage',
        });
        throw new Error(errorMessage);
    }
}

export async function refreshToken(
    domain: string,
    refreshToken: string,
    clientId: string,
    scopes: string[],
): Promise<Token> {

    try {
        const normalizedDomain = normalizeDomain(domain);
        const response = await httpCall<{ access_token: string; expires_in: number; refresh_token: string }>(
            `https://${normalizedDomain}/api/oauth/refresh`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    grant_type: REFRESH_TOKEN_GRANT_TYPE,
                    refresh_token: refreshToken,
                    client_id: clientId,
                    scope: scopes.join('+'),
                }),
            },
        );

        return {
            bearerToken: {
                tokenType: BEARER_TOKEN_TYPE,
                expiresIn: response.expires_in,
                accessToken: response.access_token,
                refreshToken: response.refresh_token,
                domain: normalizedDomain,
            },
            clientId,
            scopes,
        };
    } catch (error) {
        const errorMessage: string = 'Error refreshing token.';
        logMessage('error', {
            code: 'ERR_REFRESH_TOKEN',
            message: errorMessage,
        });
        throw new Error(errorMessage);
    }
}

export async function revokeToken(
    domain: string,
    accessToken: string,
): Promise<void> {
    try {
        await httpCall(`https://${normalizeDomain(domain)}/api/oauth/revoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: accessToken }),
        });
    } catch (error) {
        const errorMessage: string = 'Error revoking token.';
        logMessage('error', {
            code: 'ERR_TOKEN_REVOKE',
            message: errorMessage,
        });
        throw new Error(errorMessage);
    }
}
