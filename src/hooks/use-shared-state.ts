import {useSyncExternalStore} from "react";
import {useSharedStatesContext} from "../context/SharedStatesContext";
import type {AFunction, Prefix} from "../types";

class Data {
    data = new Map<string, {value: unknown; listeners: AFunction[]}>();

    addListener(key: string, prefix: Prefix, listener: AFunction) {
        if (!this.data.has(Data.prefix(key, prefix))) {
            this.data.set(Data.prefix(key, prefix), {
                value: undefined,
                listeners: [],
            });
        }
        this.data.get(Data.prefix(key, prefix))!.listeners.push(listener);
    }

    removeListener(key: string, prefix: Prefix, listener: AFunction) {
        if (this.data.has(Data.prefix(key, prefix))) {
            this.data.get(Data.prefix(key, prefix))!.listeners = this.data.get(Data.prefix(key, prefix))!.listeners.filter((l) => l !== listener);
        }
    }

    callListeners(key: string, prefix: Prefix) {
        if (this.data.has(Data.prefix(key, prefix))) {
            this.data.get(Data.prefix(key, prefix))!.listeners.forEach((listener) => listener());
        }
    }

    init(key: string, prefix: Prefix, value: unknown) {
        if (!this.data.has(Data.prefix(key, prefix))) {
            this.data.set(Data.prefix(key, prefix), {
                value,
                listeners: [],
            });
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

    setValue(key: string, prefix: Prefix, value: unknown) {
        if (this.data.has(Data.prefix(key, prefix))) {
            this.data.get(Data.prefix(key, prefix))!.value = value;
        }
    }

    has(key: string, prefix: Prefix) {
        return this.data.has(Data.prefix(key, prefix)) ? Data.prefix(key, prefix) : (this.data.has(Data.prefix(key, "_global")) ? Data.prefix(key, "_global") : undefined);
    }

    static prefix(key: string, prefix: Prefix) {
        return `${prefix}_${key}`;
    }
}

const data = new Data();

export const useSharedState = <T>(key: string, value: T) => {

    const sharedStatesContext = useSharedStatesContext();
    const prefix: Prefix = sharedStatesContext?.uniqueName ?? "_global";

    data.init(key, prefix, value);

    const dataValue = useSyncExternalStore((listener) => {
        data.init(key, prefix, value);
        data.addListener(key, prefix, listener);

        return () => {
            data.removeListener(key, prefix, listener);
        }
    }, () => data.get(key, prefix)?.value as T);

    const setData = (newValueOrCallbackToNewValue: T|((prev: T) => T)) => {
        const newValue = (typeof newValueOrCallbackToNewValue === "function") ? (newValueOrCallbackToNewValue as (prev: T) => T)(data.get(key, prefix)?.value as T) : newValueOrCallbackToNewValue
        if (newValue !== dataValue) {
            data.setValue(key, prefix, newValue);
            data.callListeners(key, prefix);
        }
    }

    return [
        dataValue,
        setData
    ] as const;
}