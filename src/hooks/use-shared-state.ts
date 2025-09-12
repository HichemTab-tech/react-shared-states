import {useMemo, useSyncExternalStore} from "react";
import type {Prefix, SharedCreated} from "../types";
import {SharedApi, SharedData} from "../SharedData";
import useShared from "./use-shared";
import {ensureNonEmptyString} from "../lib/utils";

class SharedStatesData extends SharedData<{
    value: unknown
}> {
    defaultValue() {
        return {value: undefined};
    }

    initValue(key: string, prefix: Prefix, value: unknown, isStatic: boolean = false) {
        super.init(key, prefix, {value}, isStatic);
    }

    initStatic(sharedStateCreated: SharedStateCreated<any>) {
        const {key, prefix, initialValue} = sharedStateCreated;
        this.initValue(key, prefix, initialValue, true);
    }
}

export class SharedStatesApi extends SharedApi<{
    value: unknown
}>{
    get<T, S extends string = string>(key: S, scopeName?: Prefix): T;
    get<T>(sharedStateCreated: SharedStateCreated<T>): T;
    get<T, S extends string = string>(key: S | SharedStateCreated<T>, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            return super.get(key)?.value as T;
        }
        return super.get(key, scopeName)?.value as T;
    }
    set<T, S extends string = string>(key: S, value: T, scopeName?: Prefix): void;
    set<T>(sharedStateCreated: SharedStateCreated<T>, value: T): void;
    set<T, S extends string = string>(key: S | SharedStateCreated<T>, value: T, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            super.set(key, {value});
            return;
        }
        super.set(key, {value}, scopeName);
    }
}

const sharedStatesData = new SharedStatesData();

export const sharedStatesApi = new SharedStatesApi(sharedStatesData);

export interface SharedStateCreated<T> extends SharedCreated{
    initialValue: T
}

export const createSharedState = <T>(initialValue: T, scopeName?: Prefix): SharedStateCreated<T> => {
    return sharedStatesData.createStatic<SharedStateCreated<T>>({initialValue}, scopeName);
}

export function useSharedState<T, S extends string>(key: S, initialValue: T, scopeName?: Prefix): readonly [T, (v: T | ((prev: T) => T)) => void];
export function useSharedState<T>(sharedStateCreated: SharedStateCreated<T>): readonly [T, (v: T | ((prev: T) => T)) => void];
export function useSharedState<T, S extends string>(
    key: S | SharedStateCreated<T>,
    initialValue?: T,
    scopeName?: Prefix
): readonly [T, (v: T | ((prev: T) => T)) => void] {
    let keyStr: string;
    let initVal!: T;
    let scope: Prefix | undefined = scopeName;

    if (typeof key !== "string") {
        const { key: key2, initialValue: value2, prefix: prefix2 } = key;
        keyStr = key2;
        initVal = value2;
        scope = prefix2;
    } else {
        keyStr = ensureNonEmptyString(key);
        initVal = initialValue as T;
    }

    const {prefix} = useShared(scope);

    sharedStatesData.initValue(keyStr, prefix, initVal);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore>[0]>(() => (listener) => {
        sharedStatesData.initValue(keyStr, prefix, initialValue);
        sharedStatesData.addListener(keyStr, prefix, listener);

        return () => {
            sharedStatesData.removeListener(keyStr, prefix, listener);
        }
    }, []);

    const externalStoreSnapshotGetter = useMemo(() => () => sharedStatesData.get(keyStr, prefix)?.value as T, []);

    const dataValue = useSyncExternalStore(externalStoreSubscriber, externalStoreSnapshotGetter);

    const setData = (newValueOrCallbackToNewValue: T|((prev: T) => T)) => {
        const newValue = (typeof newValueOrCallbackToNewValue === "function") ? (newValueOrCallbackToNewValue as (prev: T) => T)(sharedStatesData.get(keyStr, prefix)?.value as T) : newValueOrCallbackToNewValue
        if (newValue !== dataValue) {
            sharedStatesData.setValue(keyStr, prefix, {value:newValue});
            sharedStatesData.callListeners(keyStr, prefix);
        }
    }

    sharedStatesData.useEffect(keyStr, prefix);

    return [
        dataValue,
        setData
    ] as const;
}