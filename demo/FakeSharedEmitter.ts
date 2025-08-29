type Callback<T> = {
    onNext: (data: T) => void
    onCompletion?: () => void
    onError?: (error: unknown) => void
}

export const FakeSharedEmitter = (() => {
    const listeners = new Map<string, {
        callbacks: Callback<any>[],
        interval: NodeJS.Timeout
    }>();

    let intervalDuration: undefined|number = undefined as undefined|number;

    function start(key: string) {
        if (listeners.has(key)) return;

        const interval = setInterval(() => {
            const data = `${key} - ${Math.floor(Math.random() * 1000)}`;
            console.log("pushing through subscriber...");
            listeners.get(key)?.callbacks.forEach((cb) => cb.onNext(data));
        }, intervalDuration ?? (1000 + Math.random() * 2000));

        listeners.set(key, {
            callbacks: [],
            interval,
        });
    }

    async function subscribe<T>(key: string, onNext: Callback<T>['onNext'], onError?: Callback<T>['onError'], onCompletion?: Callback<T>['onCompletion']) {
        if (!listeners.has(key)) start(key);

        const callback = {
            onNext,
            onError,
            onCompletion
        }

        //TODO add persistance
        console.log("start loading")
        await fakeAwait(2000);
        console.log("connected")
        callback.onCompletion?.();

        const entry = listeners.get(key)!;
        entry.callbacks.push(callback);

        return () => {
            entry.callbacks = entry.callbacks.filter((cb) => cb !== callback);
            if (entry.callbacks.length === 0) {
                clearInterval(entry.interval);
                listeners.delete(key);
            }
        };
    }

    function forcePush(key: string, value: any) {
        if (listeners.has(key)) {
            listeners.get(key)!.callbacks.forEach((cb) => cb.onNext(value));
        }
    }

    // noinspection JSUnusedGlobalSymbols
    return {
        subscribe,
        forcePush,
        start,
        stop(key: string) {
            if (listeners.has(key)) {
                listeners.get(key)!.callbacks.forEach((cb) => cb.onError?.(new Error(`Stopped by user: ${key}`)));
                clearInterval(listeners.get(key)!.interval);
                listeners.delete(key);
            }
        },
        clearAll() {
            for (const key of listeners.keys()) {
                clearInterval(listeners.get(key)!.interval);
            }
            listeners.clear();
        },
        intervalDuration
    };
})();

const fakeAwait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

window.FakeSharedEmitter = FakeSharedEmitter;