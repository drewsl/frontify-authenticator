import { logMessage } from './Logger';
import { Popup, PopupConfiguration } from './Popup';
import {
    AuthenticationConfig,
    BearerToken,
    computeAuthorizationUrl,
    pollOauthSession,
    retrieveAccessToken,
    refreshToken,
    revokeToken,
} from './Oauth';

const DOMAIN_WINDOW_DEFAULT_URL = 'https://dev.frontify.test/finder';
const POPUP_DEFAULT_TITLE = 'Authorize Frontify';

export async function authorize(
    configuration: AuthenticationConfig,
    popupConfiguration?: PopupConfiguration,
): Promise<BearerToken> {
    const popUp = createPopUp(
        popupConfiguration ?? {
            width: 800,
            height: 600,
            top: 50,
            left: 50,
            title: POPUP_DEFAULT_TITLE,
        },
    );

    if (!configuration.domain) {
        await awaitUserDomain(popUp).then(() => {
            let domainInput = popUp.getDomain();

            if (domainInput) {
                configuration.domain = domainInput;
            }
        });
    }

    const { authorizationUrl, codeVerifier, sessionId } = await computeAuthorizationUrl(configuration);
    await awaitUserAuthorization(authorizationUrl, popUp);
    const authorizationCode = await pollOauthSession(configuration, sessionId);
    return retrieveAccessToken(configuration, authorizationCode, codeVerifier);

}

export async function refresh(config: AuthenticationConfig, bearerToken: BearerToken): Promise<BearerToken> {
    return await refreshToken(config, bearerToken.refreshToken);
}

export async function revoke(bearerToken: BearerToken): Promise<BearerToken> {
    await revokeToken(bearerToken.domain, bearerToken.accessToken)
    return bearerToken;
}

async function awaitUserAuthorization(authorizationUrl: string, popUp: Popup) {
    popUp.navigateToUrl(authorizationUrl);

    logMessage('warning', {
        code: 'WARN_AUTH_OPEN',
        message: 'Auth window opened!'
    });

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            popUp.close();
            reject();
            logMessage('error', {
                code: 'WARN_AUTH_SUCCESS',
                message: 'Auth timeout!'
            })
        }, 5 * 60 * 1000);

        popUp.onSuccess(() => {
            clearTimeout(timeout);
            popUp.close();
            resolve(null);
            logMessage('warning', {
                code: 'WARN_AUTH_SUCCESS',
                message: 'Auth success!'
            })
        });

        popUp.onCancelled(() => {
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

async function awaitUserDomain(popUp: Popup): Promise<void> {
    popUp.navigateToUrl(DOMAIN_WINDOW_DEFAULT_URL);

    logMessage('warning', {
        code: 'WARN_DOMAIN_OPEN',
        message: 'Domain window opened!'
    });

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
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
