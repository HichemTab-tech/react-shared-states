import type {AFunction, Prefix, SharedCreated} from "../types";
import {useMemo, useSyncExternalStore} from "react";
import {SharedValuesApi, SharedValuesManager} from "../SharedValuesManager";
import useShared from "./use-shared";
import {ensureNonEmptyString} from "../lib/utils";

export type SharedFunctionValue<T> = {
    results?: T;
    isLoading: boolean;
    error?: unknown;
}

const sharedFunctionsManager = SharedValuesManager.getInstance<SharedFunctionValue<any>>("SharedFunctionValue");
export const sharedFunctionsApi = new SharedValuesApi<SharedFunctionValue<any>>(sharedFunctionsManager);

interface SharedFunctionCreated<T, Args extends unknown[]> extends SharedCreated {
    fn: AFunction<T, Args>
}

const defaultFnValue = {
    results: undefined,
    isLoading: false,
    error: undefined,
};

export const createSharedFunction = <T, Args extends unknown[]>(fn: AFunction<T, Args>, scopeName?: Prefix): SharedFunctionCreated<T, Args> => {
    return sharedFunctionsManager.createStatic<SharedFunctionCreated<T, Args>>({fn}, defaultFnValue, scopeName);
}

export type SharedFunctionStateReturn<T, Args extends unknown[]> = {
    readonly state: NonNullable<SharedFunctionValue<T>>,
    readonly trigger: (...args: Args) => void,
    readonly forceTrigger: (...args: Args) => void,
    readonly clear: () => void,
}

export function useSharedFunction<T, Args extends unknown[], S extends string = string>(key: S, fn: AFunction<T, Args>, scopeName?: Prefix): SharedFunctionStateReturn<T, Args>;
export function useSharedFunction<T, Args extends unknown[]>(sharedFunctionCreated: SharedFunctionCreated<T, Args>): SharedFunctionStateReturn<T, Args>;
export function useSharedFunction<T, Args extends unknown[], S extends string = string>(
    key: S | SharedFunctionCreated<T, Args>,
    fn?: AFunction<T, Args>,
    scopeName?: Prefix
): SharedFunctionStateReturn<T, Args> {

    let keyStr: string;
    let fnVal!: AFunction<T, Args>;
    let scope: Prefix | undefined = scopeName;

    if (typeof key !== "string") {
        const {key: key2, fn: fn2, prefix: prefix2} = key;
        keyStr = key2;
        fnVal = fn2;
        scope = prefix2;
    } else {
        keyStr = ensureNonEmptyString(key);
        fnVal = fn as AFunction<T, Args>;
    }
    const {prefix} = useShared(scope);

    sharedFunctionsManager.init(keyStr, prefix, defaultFnValue);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedFunctionValue<T>>>>[0]>(
        () =>
            (listener) => {
                sharedFunctionsManager.init(keyStr, prefix, defaultFnValue);
                sharedFunctionsManager.addListener(keyStr, prefix, listener);

                return () => {
                    sharedFunctionsManager.removeListener(keyStr, prefix, listener);
                }
            },
        [keyStr, prefix]
    );

    const externalStoreSnapshotGetter = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedFunctionValue<T>>>>[1]>(
        () =>
            () =>
                sharedFunctionsManager.get(keyStr, prefix)!.value as NonNullable<SharedFunctionValue<T>>,
        [keyStr, prefix]
    );

    const state = useSyncExternalStore<NonNullable<SharedFunctionValue<T>>>(externalStoreSubscriber, externalStoreSnapshotGetter);

    const trigger = async (force: boolean, ...args: Args) => {
        const entry = sharedFunctionsManager.get(keyStr, prefix)!;
        if (!force && (entry.value.isLoading || entry.value.results !== undefined)) return entry.value;

        sharedFunctionsApi.update(keyStr, (prev) => ({...prev, isLoading: true, error: undefined}), prefix);

        try {
            const results: Awaited<T> = await fnVal(...args);
            sharedFunctionsApi.set(keyStr, {results, isLoading: false, error: undefined}, prefix);
        } catch (error) {
            sharedFunctionsApi.update(keyStr, (prev) => ({...prev, isLoading: false, error}), prefix);
        }
    };

    sharedFunctionsManager.useEffect(keyStr, prefix);

    return {
        state,
        trigger: (...args: Args) => {
            void trigger(false, ...args);
        },
        forceTrigger: (...args: Args) => {
            void trigger(true, ...args);
        },
        clear: () => {
            sharedFunctionsApi.set(keyStr, defaultFnValue, prefix);
        }
    } as const;
}
