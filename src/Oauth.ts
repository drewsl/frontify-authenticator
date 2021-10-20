import { encodeUrlToBase64, getRandomString, toUrlParameter, httpCall, normalizeDomain } from './Utils';
import { AuthenticatorError } from './Exception';

const CODE_VERIFIER_LENGTH = 64;
const AUTH_URL_RESPONSE_TYPE = 'code';
const AUTH_URL_CODE_CHALLENGE_METHOD = 'S256';
const AUTH_DEFAULT_REDIRECT_URL = '/connection/authenticator';
const AUTH_CODE_GRANT_TYPE = 'authorization_code';
const REFRESH_TOKEN_GRANT_TYPE = 'refresh_token';
const HASH_ALGORITHM = 'SHA-256';
const BEARER_TOKEN_TYPE = 'Bearer';

export type AuthConfiguration = {
    domain: string;
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

export async function computeAuthorizationUrl(config: AuthConfiguration): Promise<AuthorizationUrl> {
    try {
        const codeVerifier: string = getRandomString(CODE_VERIFIER_LENGTH);
        const codeChallenge: string = await computeChallengeCode(codeVerifier);
        const sessionId: string | void = (await initializeOauthSession(config.domain)) || '';

        return {
            authorizationUrl: `https://${normalizeDomain(config.domain)}/api/oauth/authorize?${toUrlParameter({
                response_type: AUTH_URL_RESPONSE_TYPE,
                client_id: config.clientId,
                scope: config.scopes.join('+'),
                code_challenge: codeChallenge,
                code_challenge_method: AUTH_URL_CODE_CHALLENGE_METHOD,
                redirect_uri: AUTH_DEFAULT_REDIRECT_URL,
                session_id: sessionId,
            })}`,
            codeVerifier,
            sessionId,
        };
    } catch {
        throw new AuthenticatorError('ERR_AUTH_COMPUTE_URL', 'Error computing authorization url.');
    }
}

export async function initializeOauthSession(domain: string): Promise<string> {
    try {
        const session = await httpCall<{ data: { key: string } }>(
            `https://${normalizeDomain(domain)}/api/oauth/create/session`,
            { method: 'POST' },
        );

        return session?.data.key;
    } catch {
        throw new AuthenticatorError('ERR_SESSION', 'Error generating session.');
    }
}

export async function pollOauthSession(config: AuthConfiguration, sessionId: string): Promise<string> {
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
        ).catch(() => {
            throw new AuthenticatorError('ERR_AUTH_POLL_REQUEST', 'Error requesting oauth session poll.');
        });

        return response.data.payload.code;
    } catch {
        throw new AuthenticatorError('ERR_AUTH_POLL', 'Error polling oauth session.');
    }
}

export async function getAccessToken(config: AuthConfiguration, code: string, codeVerifier: string): Promise<Token> {
    try {
        const normalizedDomain = normalizeDomain(config?.domain);
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
    } catch {
        throw new AuthenticatorError('ERR_AUTH_ACCESS_TOKEN', 'Error retrieving token.');
    }
}

export async function getRefreshToken(
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
    } catch {
        throw new AuthenticatorError('ERR_AUTH_REFRESH_TOKEN', 'Error refreshing token.');
    }
}

export async function revokeToken(domain: string, accessToken: string): Promise<void> {
    try {
        await httpCall(`https://${normalizeDomain(domain)}/api/oauth/revoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: accessToken }),
        });
    } catch {
        throw new AuthenticatorError('ERR_AUTH_TOKEN_REVOKE', 'Error revoking token.');
    }
}
