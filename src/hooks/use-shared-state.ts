import {useSyncExternalStore} from "react";
import type {NonEmptyString, Prefix} from "../types";
import {type SharedApi, SharedData} from "../SharedData";
import useShared from "./use-shared";

class SharedStatesData extends SharedData<{
    value: unknown
}> {
    defaultValue() {
        return {value: undefined};
    }

    init(key: string, prefix: Prefix, value: unknown) {
        super.init(key, prefix, {value});
    }

    setValue(key: string, prefix: Prefix, value: unknown) {
        super.setValue(key, prefix, {value});
    }
}

class SharedStatesApi implements SharedApi<{
    value: unknown
}>{
    get<T, S extends string = string>(key: NonEmptyString<S>, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        return sharedStatesData.get(key, prefix)?.value as T;
    }
    set<T, S extends string = string>(key: NonEmptyString<S>, value: T, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        sharedStatesData.setValue(key, prefix, {value});
    }
    clearAll() {
        sharedStatesData.clearAll();
    }
    clear(key: string, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        sharedStatesData.clear(key, prefix);
    }
    has(key: string, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        return Boolean(sharedStatesData.has(key, prefix));
    }
    getAll() {
        return sharedStatesData.data;
    }
}

export const sharedStatesApi = new SharedStatesApi();

const sharedStatesData = new SharedStatesData();

export const useSharedState = <T, S extends string = string>(key: NonEmptyString<S>, value: T, scopeName?: Prefix) => {

    const {prefix} = useShared(scopeName);

    sharedStatesData.init(key, prefix, value);

    const dataValue = useSyncExternalStore((listener) => {
        sharedStatesData.init(key, prefix, value);
        sharedStatesData.addListener(key, prefix, listener);

        return () => {
            sharedStatesData.removeListener(key, prefix, listener);
        }
    }, () => sharedStatesData.get(key, prefix)?.value as T);

    const setData = (newValueOrCallbackToNewValue: T|((prev: T) => T)) => {
        const newValue = (typeof newValueOrCallbackToNewValue === "function") ? (newValueOrCallbackToNewValue as (prev: T) => T)(sharedStatesData.get(key, prefix)?.value as T) : newValueOrCallbackToNewValue
        if (newValue !== dataValue) {
            sharedStatesData.setValue(key, prefix, newValue);
            sharedStatesData.callListeners(key, prefix);
        }
    }

    return [
        dataValue,
        setData
    ] as const;
}