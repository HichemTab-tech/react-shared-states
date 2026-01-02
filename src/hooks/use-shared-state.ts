import {useMemo, useRef, useSyncExternalStore} from "react";
import type {Prefix, SharedCreated} from "../types";
import {SharedValuesApi, SharedValuesManager} from "../SharedValuesManager";
import useShared from "./use-shared";
import {ensureNonEmptyString} from "../lib/utils";
import isEqual from "react-fast-compare";

const sharedStatesManager = SharedValuesManager.getInstance<any>("sharedStatesManager");
export const sharedStatesApi = new SharedValuesApi<any>(sharedStatesManager);

export interface SharedStateCreated<T> extends SharedCreated {
    initialValue: T
}

export const createSharedState = <T>(initialValue: T, scopeName?: Prefix): SharedStateCreated<T> => {
    return sharedStatesManager.createStatic({initialValue}, initialValue, scopeName);
}

export function useSharedState<T>(key: string, initialValue: T, scopeName?: Prefix): readonly [T, (v: T | ((prev: T) => T)) => void];
export function useSharedState<T>(sharedStateCreated: SharedStateCreated<T>): readonly [T, (v: T | ((prev: T) => T)) => void];
export function useSharedState<T>(
    key: string | SharedStateCreated<T>,
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

    sharedStatesManager.init(keyStr, prefix, initVal);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore>[0]>(() => (listener) => {
        sharedStatesManager.init(keyStr, prefix, initialValue);
        sharedStatesManager.addListener(keyStr, prefix, listener);

        return () => {
            sharedStatesManager.removeListener(keyStr, prefix, listener);
        }
    }, [keyStr, prefix, initialValue]);

    const externalStoreSnapshotGetter = useMemo(() => () => sharedStatesManager.get(keyStr, prefix)?.value as T, [keyStr, prefix]);

    const dataValue = useSyncExternalStore(externalStoreSubscriber, externalStoreSnapshotGetter);

    const setData = (newValueOrCallbackToNewValue: T|((prev: T) => T)) => {
        const newValue = (typeof newValueOrCallbackToNewValue === "function") ? (newValueOrCallbackToNewValue as (prev: T) => T)(sharedStatesManager.get(keyStr, prefix)?.value as T) : newValueOrCallbackToNewValue
        if (!isEqual(newValue, dataValue)) {
            sharedStatesManager.setValue(keyStr, prefix, newValue);
            sharedStatesManager.callListeners(keyStr, prefix);
        }
    }

    sharedStatesManager.useEffect(keyStr, prefix);

    return [
        dataValue,
        setData
    ] as const;
}

export type SharedStateSelector<S,T = S> = (original: S) => T

export function useSharedStateSelector<T, R = T>(key: string, selector: SharedStateSelector<T, R>, scopeName?: Prefix): Readonly<R>;
export function useSharedStateSelector<T, R>(sharedStateCreated: SharedStateCreated<T>, selector: SharedStateSelector<T, R>): Readonly<R>;
export function useSharedStateSelector<T, R = T>(
    key: string | SharedStateCreated<T>,
    selector: SharedStateSelector<T, R>,
    scopeName?: Prefix
): Readonly<R> {
    let keyStr: string;
    let scope: Prefix | undefined = scopeName;

    if (typeof key !== "string") {
        const { key: key2, prefix: prefix2 } = key;
        keyStr = key2;
        scope = prefix2;
    } else {
        keyStr = ensureNonEmptyString(key);
    }

    const {prefix} = useShared(scope);

    const cache = useRef<R | undefined>(undefined);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore>[0]>(() => (listener) => {
        sharedStatesManager.init(keyStr, prefix, undefined);
        sharedStatesManager.addListener(keyStr, prefix, listener);

        return () => {
            sharedStatesManager.removeListener(keyStr, prefix, listener);
        }
    }, [keyStr, prefix]);

    const externalStoreSnapshotGetter = useMemo(() => () => {
        const v = sharedStatesManager.get(keyStr, prefix)?.value as T;
        const selected = selector(v);
        if (isEqual(cache.current, selected)) {
            return cache.current as R;
        }
        cache.current = selected;
        return selected;
    }, [keyStr, prefix, selector]);

    const dataValue = useSyncExternalStore(externalStoreSubscriber, externalStoreSnapshotGetter);

    sharedStatesManager.useEffect(keyStr, prefix);

    return dataValue as Readonly<R>;
}
