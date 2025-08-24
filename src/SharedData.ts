import type {AFunction, DataMapValue, Prefix} from "./types";


type SharedDataType<T> = DataMapValue & T;

export abstract class SharedData<T> {
    data = new Map<string, SharedDataType<T>>();

    defaultValue() : T {
        return {} as T;
    }

    addListener(key: string, prefix: Prefix, listener: AFunction) {
        if (!this.data.has(SharedData.prefix(key, prefix))) {
            this.data.set(SharedData.prefix(key, prefix), {
                ...this.defaultValue,
                listeners: [],
            } as SharedDataType<T>);
        }
        this.data.get(SharedData.prefix(key, prefix))!.listeners.push(listener);
    }

    removeListener(key: string, prefix: Prefix, listener: AFunction) {
        if (this.data.has(SharedData.prefix(key, prefix))) {
            this.data.get(SharedData.prefix(key, prefix))!.listeners = this.data.get(SharedData.prefix(key, prefix))!.listeners.filter((l) => l !== listener);
        }
    }

    callListeners(key: string, prefix: Prefix) {
        if (this.data.has(SharedData.prefix(key, prefix))) {
            this.data.get(SharedData.prefix(key, prefix))!.listeners.forEach((listener) => listener());
        }
    }

    init(key: string, prefix: Prefix, data: T) {
        if (!this.data.has(SharedData.prefix(key, prefix))) {
            this.data.set(SharedData.prefix(key, prefix), {
                ...data,
                listeners: [],
            } as SharedDataType<T>);
        }
    }

    clear() {
        this.data.clear();
    }

    get(key: string, prefix: Prefix) {
        let prefixedKey = this.has(key, prefix);
        if (!prefixedKey) return undefined;
        return this.data.get(prefixedKey);
    }

    setValue(key: string, prefix: Prefix, data: T) {
        if (this.data.has(SharedData.prefix(key, prefix))) {
            this.data.set(SharedData.prefix(key, prefix), {
                ...this.data.get(SharedData.prefix(key, prefix))!,
                ...data,
            } as SharedDataType<T>)
        }
    }

    has(key: string, prefix: Prefix) {
        return this.data.has(SharedData.prefix(key, prefix)) ? SharedData.prefix(key, prefix) : (this.data.has(SharedData.prefix(key, "_global")) ? SharedData.prefix(key, "_global") : undefined);
    }

    static prefix(key: string, prefix: Prefix) {
        return `${prefix}_${key}`;
    }
}