import { logMessage } from './Logger';
import { addWindowEventListener } from './Utils';

const POPUP_DEFAULT_TITLE = 'Authorize Frontify';

export type PopupConfiguration = {
    title?: string;
    width?: number;
    height?: number;
    top?: number;
    left?: number;
};

type Configuration = {
    title: string;
    width: number;
    height: number;
    top: number;
    left: number;
};

const DEFAULT_POPUP_CONFIG = {
    title: POPUP_DEFAULT_TITLE,
    width: 800,
    height: 600,
    top: 50,
    left: 50,
};

export class Popup {
    public readonly popUp: Window | null;
    private readonly interval: NodeJS.Timer;
    private readonly unregisterEventListener: () => void;
    private static EVENT_NAME_CANCELLED: string = 'frontify-oauth-authorize-cancelled';
    private static EVENT_NAME_SUCCESS: string = 'frontify-oauth-authorize-success';
    private static EVENT_METHOD_CANCELLED: string = 'cancelled';
    private static EVENT_METHOD_SUCCESS: string = 'success';
    private static EVENT_METHOD_DOMAIN: string = 'domain';
    private static EVENT_METHOD_ABORTED: string = 'aborted';
    public listeners: { [name: string]: () => void } = {};
    private domain: string = "";

    public constructor(userConfiguration: PopupConfiguration) {
        const configuration = { ...DEFAULT_POPUP_CONFIG, ...userConfiguration };
        this.popUp = Popup.openPopUp(configuration);
        this.unregisterEventListener = addWindowEventListener('message', this.attachEventListeners());
        this.interval = setInterval(() => {
            if (this.popUp && this.popUp.closed) {
                clearInterval(this.interval);
                this.call(Popup.EVENT_METHOD_CANCELLED);
                this.call(Popup.EVENT_METHOD_ABORTED);
            }
        }, 100);
    }

    private attachEventListeners: () => void = () => {
        return (event: MessageEvent) => {
            switch (event.data) {
                case Popup.EVENT_NAME_CANCELLED:
                    this.call(Popup.EVENT_METHOD_CANCELLED);
                    break;
                case Popup.EVENT_NAME_SUCCESS:
                    this.call(Popup.EVENT_METHOD_SUCCESS);
                    break;
                default:
                    if (event.data.domain) {
                        this.setDomain(event.data.domain);
                        this.call(Popup.EVENT_METHOD_DOMAIN);
                    } else if (event.data.aborted) {
                        this.call(Popup.EVENT_METHOD_ABORTED);
                    }
                    return;
            }
        };
    };

    private static openPopUp(configuration: Configuration): Window | null {
        const popUp = window.open(
            'about:blank',
            configuration.title,
            `width=${configuration.width}, 
            height=${configuration.height}, 
            left=${configuration.left}, 
            top=${configuration.top}, 
            toolbar=no, menubar=no, 
            location=no, status=no, 
            directories=no, titlebar=no`,
        );

        if (!popUp) {
            logMessage('error', {
                code: 'ERR_POPUP_BLOCKED',
                message: 'Popup is blocked! Make sure to enable popups!',
            });
        }

        return popUp;
    }

    private call(listener: string) {
        if (this.listeners[listener]) {
            this.listeners[listener]();
        }
    }

    private setDomain(domain: string) {
        this.domain = domain;
    }

    public getDomain(): string {
        return this.domain;
    }

    public onDomain(callback: any) {
        this.listeners.domain = callback;
    }

    public onAborted(callback: any) {
        this.listeners.aborted = callback;
    }

    public onSuccess(callback: any) {
        this.listeners.success = callback;
    }

    public onCancelled(callback: any) {
        this.listeners.canceled = callback;
    }

    close() {
        this.listeners = {};
        clearInterval(this.interval);
        this.unregisterEventListener();
        if (this.popUp && !this.popUp.closed) {
            this.popUp.close();
        }
    }

    navigateToUrl(url: string) {
        if (this.popUp && !this.popUp.closed) {
            this.popUp.location.replace(url);
        } else {
            logMessage('error', {
                code: 'ERR_POPUP_CLOSED',
                message: 'Popup is closed!',
            });
        }
    }
}
