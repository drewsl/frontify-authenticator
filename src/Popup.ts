import { logMessage } from "./Logger";
import { addWindowEventListener } from "./Utils";

export type PopupConfiguration = {
    width?: number,
    height?: number,
    top?: number,
    left?: number,
    title?: string
}

type Configuration = {
    width: number,
    height: number,
    top: number,
    left: number,
    title: string
}

const DEFAULT_POPUP_CONFIG = {
    width: 800,
    height: 600,
    top: 50,
    left: 50,
    title: 'Authorize Frontify'
}

export class Popup {
    private readonly popUp: Window|null;
    private readonly unregisterEventListener: Function
    private static CANCELLED_EVENT = 'frontify-oauth-authorize-cancelled';
    private static SUCCESS_EVENT = 'frontify-oauth-authorize-success';
    private listeners: { [name: string]: Function } = {}
    private readonly interval: NodeJS.Timer;

    public constructor(userConfiguration: PopupConfiguration) {
        const configuration = {...DEFAULT_POPUP_CONFIG, ...userConfiguration};
        this.popUp = Popup.createPopUp(configuration);
        this.unregisterEventListener = addWindowEventListener('message', this.attachEventListeners());
        this.interval = setInterval(() => {
            if (this.popUp && this.popUp.closed) {
                clearInterval(this.interval);
                this.call('cancelled');
            }
        }, 100);
    }

    private attachEventListeners(): Function {
        return (event: MessageEvent) => {
            switch (event.data) {
                case Popup.CANCELLED_EVENT:
                    this.call('cancelled');
                    break;
                case Popup.SUCCESS_EVENT:
                    this.call('success');
                    break;
                default:
                    return;
            }
        }
    }

    private static createPopUp(configuration: Configuration): Window|null {
        const popUp = window.open('about:blank',
            configuration.title,
            `width=${configuration.width}, 
            height=${configuration.height}, 
            left=${configuration.left}, 
            top=${configuration.top}, 
            toolbar=no, menubar=no, 
            location=no, status=no, 
            directories=no, titlebar=no`
        );
        if (!popUp) {
            logMessage('error', {
                code: 'ERR_POPUP_BLOCKED',
                message: 'Popup is blocked! Make sure to enable popups!'
            });
        }
        return popUp;
    }

    private call(listener: 'success' | 'cancelled') {
        if (this.listeners[listener]) {
            this.listeners[listener]();
        }
    }

    public onSuccess(callback: Function) {
        this.listeners['success'] = callback;
    }

    public onCancelled(callback: Function) {
        this.listeners['canceled'] = callback;
    }

    close() {
        this.listeners = {};
        clearInterval(this.interval);
        this.unregisterEventListener();
        if (this.popUp && !this.popUp.closed) {
            this.popUp.close()
        }
    }

    navigateToUrl(url: string) {
        if (this.popUp && !this.popUp.closed) {
            this.popUp.location.replace(url)
        } else {
            logMessage('error', {
                code: 'ERR_POPUP_CLOSED',
                message: 'Popup is closed!'
            });
        }
    }
}