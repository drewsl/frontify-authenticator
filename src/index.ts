import { AuthenticatorError } from './Exception';
import { logMessage } from './Logger';
import { Popup, PopupConfiguration } from './Popup';
import {
    AuthConfiguration,
    Token,
    computeAuthorizationUrl,
    pollOauthSession,
    getAccessToken,
    getRefreshToken,
    revokeToken,
} from './Oauth';

export type AuthConfigurationInput = {
    domain?: string;
    clientId: string;
    scopes: string[];
};

const DOMAIN_WINDOW_DEFAULT_URL = 'https://app.frontify.com/finder';
const POPUP_DEFAULT_TITLE = 'Authorize Frontify';
const POPUP_STATE = {
    open: false,
};

let popup: Popup;
let token: Token;
let domainPopUpTimeout: NodeJS.Timeout;
let authTimeout: NodeJS.Timeout;

export async function authorize(
    configuration: AuthConfigurationInput,
    popupConfiguration?: PopupConfiguration,
): Promise<Token> {
    if (POPUP_STATE.open) {
        POPUP_STATE.open = false;
        popup.close();
    }

    popup = createPopUp(
        popupConfiguration ?? {
            title: POPUP_DEFAULT_TITLE,
            width: 800,
            height: 600,
            top: 50,
            left: 50,
        },
    );

    POPUP_STATE.open = true;

    if (!configuration.domain) {
        await openDomainPopUp(configuration, popup)
            .then((result: Token): Token | void => {
                POPUP_STATE.open = false;
                if (result) {
                    token = result;
                }
            })
            .catch(() => {
                delete configuration.domain;
            });
    }

    await authenticate(configuration as AuthConfiguration, popup).then((result: Token): Token | void => {
        POPUP_STATE.open = false;
        if (result) {
            token = result;
        }
    });

    if (!token) {
        throw new AuthenticatorError('ERR_AUTH', 'No token returned.');
    }

    return token;
}

export async function refresh(tokenInput: Token): Promise<Token> {
    return getRefreshToken(
        tokenInput.bearerToken.domain,
        tokenInput.bearerToken.refreshToken,
        tokenInput.clientId,
        tokenInput.scopes,
    );
}

export async function revoke(tokenInput: Token): Promise<Token> {
    await revokeToken(tokenInput.bearerToken.domain, tokenInput.bearerToken.accessToken);
    return tokenInput;
}

async function authenticate(configuration: AuthConfiguration, popUp: Popup): Promise<Token> {
    try {
        const computedAuthorization = await computeAuthorizationUrl(configuration);
        await openAuthPopUp(computedAuthorization.authorizationUrl, popUp);
        const authorizationCode = await pollOauthSession(configuration, computedAuthorization.sessionId);
        return getAccessToken(configuration, authorizationCode, computedAuthorization.codeVerifier);
    } catch (error) {
        const errorMessage = `Error generating session. Make sure that the inserted domain is a valid and secure Frontify instance.`;
        popUp.popUp?.postMessage({ domainError: errorMessage }, '*');

        if (error instanceof AuthenticatorError && error.code === 'ERR_COMPUTE_AUTH_URL') {
            throw new AuthenticatorError('ERR_AUTH_SESSION', 'Failed generating session.');
        }

        POPUP_STATE.open = false;
        throw new AuthenticatorError('ERR_AUTH', 'Failed getting access token.');
    }
}

function openDomainPopUp(configuration: AuthConfigurationInput, popUp: Popup): Promise<Token> {
    popUp.navigateToUrl(DOMAIN_WINDOW_DEFAULT_URL);

    logMessage('warning', {
        code: 'WARN_DOMAIN_OPEN',
        message: 'Popup window opened!',
    });

    return new Promise((resolve) => {
        domainPopUpTimeout = setTimeout(() => {
            POPUP_STATE.open = false;
            popUp.close();
            logMessage('warning', {
                code: 'WARN_DOMAIN_TIMEOUT',
                message: 'Popup window timed out!',
            });
        }, 5 * 60 * 1000);

        popUp.onDomain(() => {
            clearTimeout(domainPopUpTimeout);
            configuration.domain = popup.getDomain();
            const authorizationConfiguration = configuration as AuthConfiguration;
            authenticate(authorizationConfiguration, popup)
                .then((result) => {
                    if (result) {
                        resolve(result);
                    }
                })
                .catch(() => {
                    delete configuration.domain;
                });

            logMessage('warning', {
                code: 'WARN_DOMAIN_SELECT',
                message: 'Domain input submitted!',
            });
        });

        popUp.onAborted(() => {
            POPUP_STATE.open = false;
            clearTimeout(domainPopUpTimeout);
            logMessage('warning', {
                code: 'WARN_DOMAIN_CLOSED',
                message: 'Popup window closed!',
            });
            popUp.close();
        });
    });
}

function openAuthPopUp(url: string, popUp: Popup): Promise<void> {
    popUp.navigateToUrl(url);

    logMessage('warning', {
        code: 'WARN_DOMAIN_OPEN',
        message: 'Popup window opened!',
    });

    return new Promise((resolve) => {
        authTimeout = setTimeout(() => {
            POPUP_STATE.open = false;
            popUp.close();
            logMessage('warning', {
                code: 'WARN_AUTH_TIMEOUT',
                message: 'Popup window timed out!',
            });
        }, 5 * 60 * 1000);

        popUp.onAborted(() => {
            POPUP_STATE.open = false;
            clearTimeout(authTimeout);
            popUp.close();
            logMessage('warning', {
                code: 'WARN_DOMAIN_CLOSED',
                message: 'Popup window closed!',
            });
        });

        popUp.onSuccess(() => {
            POPUP_STATE.open = false;
            clearTimeout(authTimeout);
            popUp.close();
            resolve();
            logMessage('warning', {
                code: 'WARN_AUTH_SUCCESS',
                message: 'Auth success!',
            });
        });

        popUp.onCancelled(() => {
            POPUP_STATE.open = false;
            clearTimeout(authTimeout);
            popUp.close();
            logMessage('warning', {
                code: 'WARN_AUTH_CANCELLED',
                message: 'Auth cancelled!',
            });
        });
    });
}

function createPopUp(configuration: PopupConfiguration): Popup {
    return new Popup(configuration ?? {});
}
