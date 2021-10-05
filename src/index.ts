import { logMessage } from './Logger';
import { Popup, PopupConfiguration } from './Popup';
import {
    AuthenticationConfig,
    Token,
    computeAuthorizationUrl,
    pollOauthSession,
    retrieveAccessToken,
    refreshToken,
    revokeToken,
} from './Oauth';

const DOMAIN_WINDOW_DEFAULT_URL = 'https://dev.frontify.test/finder';
const POPUP_DEFAULT_TITLE = 'Authorize Frontify';
const POPUP_STATE = {
    open: false,
};

let popup: Popup;

export async function authorize(
    configuration: AuthenticationConfig,
    popupConfiguration?: PopupConfiguration,
): Promise<Token | void> {
    if (POPUP_STATE.open) {
        logMessage('warning', {
            code: 'ERR_POPUP_OPEN',
            message: 'Popup already open!',
        });
        throw new Error('Popup already open!');
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
        return openDomainPopUp(configuration, popup)
            .then((res) => {
                POPUP_STATE.open = false;
                if (res) {
                    return res;
                }
            })
            .catch(() => {
                delete configuration.domain;
                logMessage('error', {
                    code: 'ERR_AUTH_SKIPPED',
                    message: 'Domain not inserted!',
                });
                throw new Error('Domain not inserted!');
            });
    } else {
        return authenticate(configuration, popup)
            .then((res) => {
                POPUP_STATE.open = false;
                if (res) {
                    return res;
                }
            })
            .catch((error) => {
                POPUP_STATE.open = false;
                throw new Error(error);
            });
    }
}

export async function refresh(token: Token): Promise<Token> {
    return refreshToken(token.bearerToken.domain, token.bearerToken.refreshToken, token.clientId, token.scopes);
}

export async function revoke(token: Token): Promise<Token> {
    await revokeToken(token.bearerToken.domain, token.bearerToken.accessToken);
    return token;
}

async function authenticate(configuration: AuthenticationConfig, popUp: Popup): Promise<Token> {
    try {
        const { authorizationUrl, codeVerifier, sessionId } = await computeAuthorizationUrl(configuration);
        await openAuthPopUp(authorizationUrl, popUp);
        const authorizationCode = await pollOauthSession(configuration, sessionId);
        return retrieveAccessToken(configuration, authorizationCode, codeVerifier);
    } catch (error) {
        const errorMessage = `Error generating session. Make sure that the inserted domain is a valid and secure Frontify instance.`;
        popUp.popUp?.postMessage({ domainError: errorMessage }, '*');
        logMessage('error', {
            code: 'ERR_AUTH_FAILED',
            message: errorMessage,
        });
        throw new Error(errorMessage);
    }
}

function openDomainPopUp(configuration: AuthenticationConfig, popUp: Popup): Promise<Token> {
    popUp.navigateToUrl(DOMAIN_WINDOW_DEFAULT_URL);

    logMessage('warning', {
        code: 'WARN_DOMAIN_OPEN',
        message: 'Popup window opened!',
    });

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            POPUP_STATE.open = false;
            popUp.close();
            reject();
            logMessage('error', {
                code: 'ERR_DOMAIN_TIMEOUT',
                message: 'Popup window timeout!',
            });
        }, 5 * 60 * 1000);

        popUp.onDomain(() => {
            clearTimeout(timeout);
            configuration.domain = popup.getDomain();
            authenticate(configuration, popup)
                .then((result) => {
                    resolve(result);
                })
                .catch((error) => {
                    throw new Error(error ?? 'Could not verify instance!');
                });
            logMessage('warning', {
                code: 'WARN_DOMAIN_SELECT',
                message: 'Domain input submitted!',
            });
        });

        popUp.onAborted(() => {
            POPUP_STATE.open = false;
            clearTimeout(timeout);
            popUp.close();
            reject();
            logMessage('warning', {
                code: 'WARN_DOMAIN_CLOSED',
                message: 'Popup window closed!',
            });
        });
    });
}

function openAuthPopUp(url: string, popUp: Popup): Promise<void> {
    popUp.navigateToUrl(url);

    logMessage('warning', {
        code: 'WARN_DOMAIN_OPEN',
        message: 'Popup window opened!',
    });

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            POPUP_STATE.open = false;
            popUp.close();
            reject();
            logMessage('error', {
                code: 'ERR_DOMAIN_TIMEOUT',
                message: 'Popup window timeout!',
            });
        }, 5 * 60 * 1000);

        popUp.onAborted(() => {
            POPUP_STATE.open = false;
            clearTimeout(timeout);
            popUp.close();
            reject();
            logMessage('warning', {
                code: 'WARN_DOMAIN_CLOSED',
                message: 'Popup window closed!',
            });
        });

        popUp.onSuccess(() => {
            POPUP_STATE.open = false;
            clearTimeout(timeout);
            popUp.close();
            resolve();
            logMessage('warning', {
                code: 'WARN_AUTH_SUCCESS',
                message: 'Auth success!',
            });
        });

        popUp.onCancelled(() => {
            POPUP_STATE.open = false;
            clearTimeout(timeout);
            popUp.close();
            reject();
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
