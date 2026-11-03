import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { showToast } from "@webpack/common";

const logger = new Logger("SpotifyPauseBlocker", "#1DB954");

const settings = definePluginSettings({
    showToasts: {
        type: OptionType.BOOLEAN,
        description: "Show a toast when the blocker starts",
        default: true,
    },
});

const SPOTIFY_HOST = "api.spotify.com";
const PAUSE_PATH = "/v1/me/player/pause";

// Properties we define on a blocked XHR instance; removed again on the next open()
const FAKE_XHR_KEYS = ["readyState", "status", "statusText", "response", "responseText", "responseURL"] as const;

let _realFetch: typeof fetch | null = null;
let _realXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
let _realXHRSend: typeof XMLHttpRequest.prototype.send | null = null;
let _hidePopupInterval: ReturnType<typeof setInterval> | null = null;

const blockedXHRs = new WeakSet<XMLHttpRequest>();

/**
 * Matches by host + path so query strings (e.g. ?device_id=...) don't bypass the block.
 * Spotify's pause endpoint is a PUT request.
 */
function isPauseRequest(url: string, method?: string): boolean {
    try {
        const u = new URL(url, location.href);
        if (u.hostname !== SPOTIFY_HOST || u.pathname !== PAUSE_PATH) return false;
        return !method || method.toUpperCase() === "PUT";
    } catch {
        return false;
    }
}

function fakeXHRSuccess(xhr: XMLHttpRequest, url: string) {
    const values: Record<string, unknown> = {
        readyState: 4,
        status: 204,
        statusText: "No Content",
        response: "",
        responseText: "",
        responseURL: url,
    };
    for (const key of FAKE_XHR_KEYS) {
        Object.defineProperty(xhr, key, { value: values[key], configurable: true });
    }

    // Fire events async, like a real request would
    setTimeout(() => {
        xhr.dispatchEvent(new Event("readystatechange"));
        xhr.dispatchEvent(new ProgressEvent("load"));
        xhr.dispatchEvent(new ProgressEvent("loadend"));
    }, 0);
}

function enableBlocker() {
    if (!_realFetch) {
        const realFetch = window.fetch;
        _realFetch = realFetch;

        window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const method = init?.method ?? (input instanceof Request ? input.method : "GET");

            if (isPauseRequest(url, method)) {
                logger.info("Blocked Spotify pause via fetch");
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            return realFetch.call(window, input, init);
        };
    }

    if (!_realXHROpen && !_realXHRSend) {
        const realOpen = XMLHttpRequest.prototype.open;
        const realSend = XMLHttpRequest.prototype.send;
        _realXHROpen = realOpen;
        _realXHRSend = realSend;

        XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
            // Clean up fake properties if this XHR object is being reused
            for (const key of FAKE_XHR_KEYS) delete (this as any)[key];

            const urlStr = url.toString();
            if (isPauseRequest(urlStr, method)) {
                blockedXHRs.add(this);
                (this as any).__spbUrl = urlStr;
            } else {
                blockedXHRs.delete(this);
            }
            return (realOpen as any).call(this, method, url, ...rest);
        } as typeof XMLHttpRequest.prototype.open;

        XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
            if (blockedXHRs.has(this)) {
                logger.info("Blocked Spotify pause via XHR");
                fakeXHRSuccess(this, (this as any).__spbUrl ?? "");
                return;
            }
            return realSend.call(this, body);
        };
    }

    if (!_hidePopupInterval) {
        _hidePopupInterval = setInterval(() => {
            const popup = document.querySelector<HTMLElement>(".popup-container.popup-show");
            if (popup) popup.style.display = "none";
        }, 500);
    }

    logger.info("Spotify Pause Blocker enabled");
    if (settings.store.showToasts) {
        showToast({ text: "SpotifyPauseBlocker: enabled", variant: "success" });
    }
}

function disableBlocker() {
    if (_realFetch) {
        window.fetch = _realFetch;
        _realFetch = null;
    }
    if (_realXHROpen) {
        XMLHttpRequest.prototype.open = _realXHROpen;
        _realXHROpen = null;
    }
    if (_realXHRSend) {
        XMLHttpRequest.prototype.send = _realXHRSend;
        _realXHRSend = null;
    }
    if (_hidePopupInterval) {
        clearInterval(_hidePopupInterval);
        _hidePopupInterval = null;
    }
    logger.info("Spotify Pause Blocker disabled");
}

export default definePlugin({
    name: "SpotifyPauseBlocker",
    description: "Stops Discord from pausing Spotify",
    authors: [Devs["3Tb"]],
    tags: ["Utility"],
    settings,

    start() {
        enableBlocker();
    },

    stop() {
        disableBlocker();
    },
});
