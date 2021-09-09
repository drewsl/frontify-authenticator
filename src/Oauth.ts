import { encodeUrlToBase64, getRandomString, toUrlParameter, httpCall, normalizeDomain } from "./Utils";
import { logMessage } from "./Logger";

const CODE_VERIFIER_LENGTH = 64

export type AuthenticationConfig = {
    domain: string,
    clientId: string,
    scopes: Array<string>,
    redirectUri?: string,
}

export type AuthorizationUrl = {
    authorizationUrl: string,
    codeVerifier: string,
    sessionId: string
}

export type BearerToken = {
    tokenType: 'Bearer',
    expiresIn: number,
    accessToken: string,
    refreshToken: string,
    domain: string
}

async function computeChallengeCode(codeVerifier: string): Promise<string> {
    let array = new TextEncoder().encode(codeVerifier)
    const digest = await window.crypto.subtle.digest('SHA-256', array);
    const hash = String.fromCharCode.apply(null, Array.from(new Uint8Array(digest)));
    return encodeUrlToBase64(hash)
}

export async function computeAuthorizationUrl(config: AuthenticationConfig): Promise<AuthorizationUrl> {
    const codeVerifier = getRandomString(CODE_VERIFIER_LENGTH)
    const codeChallenge = await computeChallengeCode(codeVerifier)

    const sessionId = await initializeOauthSession(config)

    const urlParameters = {
        response_type: 'code',
        client_id: config.clientId,
        scope: config.scopes.join('+'),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        redirect_uri: config.redirectUri ?? '/connection/authenticator',
        session_id: sessionId
    }

    return {
        authorizationUrl: `https://${normalizeDomain(config.domain)}/api/oauth/authorize?${toUrlParameter(urlParameters)}`,
        codeVerifier,
        sessionId
    }
}

export async function initializeOauthSession(config: AuthenticationConfig): Promise<string> {
    try {
        const session = await httpCall<{ data: { key: string } }>(
            `https://${normalizeDomain(config.domain)}/api/oauth/create/session`, { method: 'POST' }
        );
        return session.data.key;
    } catch (error) {
        logMessage('error', {
            code: 'ERR_SESSION',
            message: 'Error generating session.',
        });
        throw new Error('Error generating session.');
    }
}

export async function pollOauthSession(
    config: AuthenticationConfig,
    sessionId: string
): Promise<string> {
    const response = await httpCall<{ data: { payload: { code: string } } }>(
        `https://${normalizeDomain(config.domain)}/api/oauth/poll`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                session_id: sessionId
            })
        });

    return response.data.payload.code
}

export async function retrieveAccessToken(
    config: AuthenticationConfig,
    code: string,
    codeVerifier: string
): Promise<BearerToken> {
    const parameters = {
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        client_id: config.clientId,
        redirect_uri: config.redirectUri ?? '/connection/authenticator'
    }

    const response = await httpCall<{ access_token: string, expires_in: number, refresh_token: string }>(
        `https://${normalizeDomain(config.domain)}/api/oauth/accesstoken`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(parameters)
        });

    return {
        tokenType: 'Bearer',
        expiresIn: response.expires_in,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        domain: normalizeDomain(config.domain)
    }
}

export async function revokeAccessToken({bearerToken, domain}: { bearerToken: string, domain: string }): Promise<void> {
    try {
        await httpCall(`https://${domain}/api/oauth/revoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({token: bearerToken})
        });
    } catch (error) {
        logMessage('error', {
           code: 'ERR_TOKEN_REVOKE',
           message: 'Access token could not be revoked!'
        });
    }
}