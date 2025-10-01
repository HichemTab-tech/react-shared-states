import {useMemo, useRef, useSyncExternalStore} from "react";
import type {Prefix, SharedCreated} from "../types";
import {SharedValuesApi, SharedValuesManager} from "../SharedValuesManager";
import useShared from "./use-shared";
import {ensureNonEmptyString} from "../lib/utils";
import type {SharedValue} from "../types";
import isEqual from "react-fast-compare";
//import {} from "react-fast-compare"

interface SharedState<T> extends SharedValue {
    value: T
}

class SharedStatesManager extends SharedValuesManager<SharedState<unknown>, { value: unknown }> {
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

export class SharedStatesApi extends SharedValuesApi<SharedState<unknown>, { value: unknown }, unknown>{
    constructor(sharedStateManager: SharedStatesManager) {
        super(sharedStateManager);
    }
    get<T, S extends string = string>(key: S, scopeName?: Prefix): T;
    get<T>(sharedStateCreated: SharedStateCreated<T>): T;
    get<T, S extends string = string>(key: S | SharedStateCreated<T>, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            return (super.get(key) as SharedState<T>)?.value;
        }
        return (super.get(key, scopeName) as SharedState<T>)?.value;
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
    update<T, S extends string = string>(key: S, updater: (prev: T) => T, scopeName?: Prefix): void;
    update<T>(sharedStateCreated: SharedStateCreated<T>, updater: (prev: T) => T): void;
    update<T, S extends string = string>(key: S | SharedStateCreated<T>, updater: (prev: T) => T, scopeName: Prefix = "_global") {
        let prev: T;
        if (typeof key === "string") {
            prev = this.get(key, scopeName);
        } else {
            prev = this.get(key);
        }
        const newValue = updater(prev);
        if (typeof key === "string") {
            this.set(key, newValue, scopeName);
        } else {
            this.set(key, newValue);
        }
    }
}

const sharedStatesManager = new SharedStatesManager();

export const sharedStatesApi = new SharedStatesApi(sharedStatesManager);

export interface SharedStateCreated<T> extends SharedCreated{
    initialValue: T
}

export const createSharedState = <T>(initialValue: T, scopeName?: Prefix): SharedStateCreated<T> => {
    return sharedStatesManager.createStatic<SharedStateCreated<T>>({initialValue}, scopeName);
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

    sharedStatesManager.initValue(keyStr, prefix, initVal);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore>[0]>(() => (listener) => {
        sharedStatesManager.initValue(keyStr, prefix, initialValue);
        sharedStatesManager.addListener(keyStr, prefix, listener);

        return () => {
            sharedStatesManager.removeListener(keyStr, prefix, listener);
        }
    }, []);

    const externalStoreSnapshotGetter = useMemo(() => () => sharedStatesManager.get(keyStr, prefix)?.value as T, []);

    const dataValue = useSyncExternalStore(externalStoreSubscriber, externalStoreSnapshotGetter);

    const setData = (newValueOrCallbackToNewValue: T|((prev: T) => T)) => {
        const newValue = (typeof newValueOrCallbackToNewValue === "function") ? (newValueOrCallbackToNewValue as (prev: T) => T)(sharedStatesManager.get(keyStr, prefix)?.value as T) : newValueOrCallbackToNewValue
        if (newValue !== dataValue) {
            sharedStatesManager.setValue(keyStr, prefix, {value:newValue});
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

export function useSharedStateSelector<T, S extends string, R>(key: S, selector: SharedStateSelector<T, R>, scopeName?: Prefix): Readonly<R>;
export function useSharedStateSelector<T, R>(sharedStateCreated: SharedStateCreated<T>, selector: SharedStateSelector<T, R>): Readonly<R>;
export function useSharedStateSelector<T, S extends string, R>(
    key: S | SharedStateCreated<T>,
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

    const cache = useRef<R>(undefined);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore>[0]>(() => (listener) => {
        sharedStatesManager.addListener(keyStr, prefix, listener);

        return () => {
            sharedStatesManager.removeListener(keyStr, prefix, listener);
        }
    }, []);

    const externalStoreSnapshotGetter = useMemo(() => () => {
        const v = sharedStatesManager.get(keyStr, prefix)?.value as T;
        const selected = selector(v);
        if (isEqual(cache.current, selected)) {
            return cache.current;
        }
        return selected;
    }, []);

    const dataValue = useSyncExternalStore(externalStoreSubscriber, externalStoreSnapshotGetter);

    sharedStatesManager.useEffect(keyStr, prefix);

    return dataValue as Readonly<R>;
}
