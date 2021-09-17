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
    retry: false
}

let popup: Popup;

export async function authorize(
    configuration: AuthenticationConfig,
    popupConfiguration?: PopupConfiguration,
): Promise<Token | void | null>{
    let token = null;

    if (POPUP_STATE.open) {
        console.log('popup is already open!');
        return;
    }

    POPUP_STATE.open = true;

    if (!POPUP_STATE.retry) {
        popup = createPopUp(
            popupConfiguration ?? {
                width: 800,
                height: 600,
                top: 50,
                left: 50,
                title: POPUP_DEFAULT_TITLE,
            },
        );
    }

    if (!configuration.domain) {
        await openDomainPopUp(popup).then(() => {
            configuration.domain = popup.getDomain();
            POPUP_STATE.retry = false;
            token = authenticate(configuration, popup).catch(() => {
                delete(configuration.domain);
                POPUP_STATE.retry = true;
                authorize(configuration, popupConfiguration);
            });
        });
    } else {
        POPUP_STATE.retry = false;
        token = authenticate(configuration, popup).catch(() => {
            delete(configuration.domain);
            POPUP_STATE.retry = true;
            authorize(configuration, popupConfiguration);
        });
    }

    return token;

}

async function authenticate(configuration: AuthenticationConfig, popUp: Popup): Promise<Token> {
    try {
        const { authorizationUrl, codeVerifier, sessionId } = await computeAuthorizationUrl(configuration);
        await awaitUserAuthorization(authorizationUrl, popUp);
        const authorizationCode = await pollOauthSession(configuration, sessionId);
        return retrieveAccessToken(configuration, authorizationCode, codeVerifier);
    } catch (error) {
        const errorMessage = `Error generating session. Make sure the inserted domain ${configuration.domain} is a valid and secure Frontify instance`;
        delete(configuration.domain);
        popUp.popUp?.postMessage({domainError: errorMessage}, '*');
        logMessage('error', {
            code: 'ERR_AUTH_FAILED',
            message: errorMessage
        });
        throw new Error(errorMessage);
    }
}

export async function refresh(token: Token): Promise<Token> {
    return await refreshToken(token.bearerToken.domain, token.bearerToken.refreshToken, token.clientId, token.scopes);
}

export async function revoke(token: Token): Promise<Token> {
    await revokeToken(token.bearerToken.domain, token.bearerToken.accessToken)
    return token;
}

async function awaitUserAuthorization(authorizationUrl: string, popUp: Popup) {
    popUp.navigateToUrl(authorizationUrl);

    logMessage('warning', {
        code: 'WARN_AUTH_OPEN',
        message: 'Auth window opened!'
    });

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            POPUP_STATE.open = false;
            popUp.close();
            reject();
            logMessage('error', {
                code: 'WARN_AUTH_SUCCESS',
                message: 'Auth timeout!'
            })
        }, 5 * 60 * 1000);

        popUp.onSuccess(() => {
            POPUP_STATE.open = false;
            clearTimeout(timeout);
            popUp.close();
            resolve(null);
            logMessage('warning', {
                code: 'WARN_AUTH_SUCCESS',
                message: 'Auth success!'
            })
        });

        popUp.onCancelled(() => {
            POPUP_STATE.open = false;
            clearTimeout(timeout);
            popUp.close();
            reject();
            logMessage('warning', {
                code: 'WARN_AUTH_CANCELLED',
                message: 'Auth cancelled!'
            })
        });
    });
}

function openDomainPopUp(popUp: Popup): Promise<void> {
    if (!POPUP_STATE.retry) {
        popUp.navigateToUrl(DOMAIN_WINDOW_DEFAULT_URL);
        logMessage('warning', {
            code: 'WARN_DOMAIN_OPEN',
            message: 'Domain window opened!'
        });
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            POPUP_STATE.open = false;
            popUp.close();
            reject();
            logMessage('error', {
                code: 'ERR_DOMAIN_TIMEOUT',
                message: 'Domain window timeout!'
            })
        }, 5 * 60 * 1000);

        popUp.onDomain(() => {
            clearTimeout(timeout);
            resolve();
            logMessage('warning', {
                code: 'WARN_DOMAIN_SELECT',
                message: 'Domain select success!'
            })
        });

        popUp.onAborted(() => {
            POPUP_STATE.open = false;
            clearTimeout(timeout);
            popUp.close();
            reject();
            logMessage('warning', {
                code: 'WARN_DOMAIN_CLOSED',
                message: 'Domain window closed!'
            })
        });
    });
}

function createPopUp(configuration: PopupConfiguration): Popup {
    return new Popup(configuration ?? {});
}
