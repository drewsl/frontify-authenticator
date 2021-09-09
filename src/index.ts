import { Popup, PopupConfiguration } from "./Popup";
import {
    AuthenticationConfig,
    BearerToken,
    computeAuthorizationUrl,
    pollOauthSession,
    retrieveAccessToken,
    revokeAccessToken
} from "./Oauth";

export async function authorize(configuration: AuthenticationConfig, popupConfiguration?: PopupConfiguration): Promise<BearerToken> {
    const popUp = createPopUp(popupConfiguration ?? {
        width: 800,
        height: 600,
        top: 50,
        left: 50,
        title: "Authorize Frontify"
    });

    const { authorizationUrl, codeVerifier, sessionId } = await computeAuthorizationUrl(configuration);
    await awaitUserAuthorization(authorizationUrl, popUp);
    const authorizationCode = await pollOauthSession(configuration, sessionId);
    return retrieveAccessToken(configuration, authorizationCode, codeVerifier);
}

// export refresh

export async function revoke(token: BearerToken): Promise<void> {
    return await revokeAccessToken({bearerToken: token.accessToken, domain: token.domain});
}

async function awaitUserAuthorization(authorizationUrl: string, popUp: Popup) {
    popUp.navigateToUrl(authorizationUrl);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            popUp.close();
            reject(new Error('Login timeout!'));
        }, 5 * 60 * 1000);

        popUp.onSuccess(() => {
            clearTimeout(timeout);
            popUp.close();
            resolve(null);
        });

        popUp.onCancelled(() => {
            clearTimeout(timeout);
            popUp.close();
            reject(new Error('Login canceled!'));
        });
    });
}

function createPopUp(configuration: PopupConfiguration): Popup {
    return new Popup(configuration ?? {});
}