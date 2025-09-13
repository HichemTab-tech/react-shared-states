import type {AFunction, Prefix, SharedCreated, SharedValue} from "../types";
import {useMemo, useSyncExternalStore} from "react";
import {SharedValuesApi, SharedValuesManager} from "../SharedValuesManager";
import useShared from "./use-shared";
import {ensureNonEmptyString} from "../lib/utils";

type SharedFunctionValue<T> = {
    results?: T;
    isLoading: boolean;
    error?: unknown;
}

interface SharedFunction<T> extends SharedValue {
    fnState: SharedFunctionValue<T>
}

class SharedFunctionsManager extends SharedValuesManager<SharedFunction<unknown>, { fnState: SharedFunctionValue<unknown> }> {
    defaultValue() {
        return {
            fnState: {
                results: undefined,
                isLoading: false,
                error: undefined,
            }
        };
    }

    initValue(key: string, prefix: Prefix, isStatic: boolean = false) {
        super.init(key, prefix, this.defaultValue(), isStatic);
    }

    setValue<T>(key: string, prefix: Prefix, data: { fnState: SharedFunctionValue<T> }) {
        super.setValue(key, prefix, data);
    }
}

export class SharedFunctionsApi extends SharedValuesApi<SharedFunction<unknown>, { fnState: SharedFunctionValue<unknown> }, SharedFunctionValue<unknown>>{
    constructor(sharedFunctionManager: SharedFunctionsManager) {
        super(sharedFunctionManager);
    }
    get<T, S extends string = string>(key: S, scopeName?: Prefix): SharedFunctionValue<T>;
    get<T, Args extends unknown[]>(sharedFunctionCreated: SharedFunctionCreated<T, Args>): SharedFunctionValue<T>;
    get<T, Args extends unknown[], S extends string = string>(key: S | SharedFunctionCreated<T, Args>, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            return (super.get(key) as unknown as SharedFunction<T>)?.fnState;
        }
        return (super.get(key, scopeName) as unknown as SharedFunction<T>)?.fnState;
    }
    set<T, S extends string = string>(key: S, value: { fnState: SharedFunctionValue<T> }, scopeName?: Prefix): void;
    set<T, Args extends unknown[]>(sharedFunctionCreated: SharedFunctionCreated<T, Args>, value: { fnState: SharedFunctionValue<T> }): void;
    set<T, Args extends unknown[], S extends string = string>(key: S | SharedFunctionCreated<T, Args>, value: { fnState: SharedFunctionValue<T> }, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            super.set(key, value);
            return;
        }
        super.set(key, value, scopeName);
    }
}

const sharedFunctionsManager = new SharedFunctionsManager();

export const sharedFunctionsApi = new SharedFunctionsApi(sharedFunctionsManager);

interface SharedFunctionCreated<T, Args extends unknown[]> extends SharedCreated{
    fn: AFunction<T, Args>
}

export const createSharedFunction = <T, Args extends unknown[]>(fn: AFunction<T, Args>, scopeName?: Prefix): SharedFunctionCreated<T, Args> => {
    return sharedFunctionsManager.createStatic<SharedFunctionCreated<T, Args>>({fn}, scopeName);
}

export type SharedFunctionStateReturn<T, Args extends unknown[]> = {
    readonly state: NonNullable<SharedFunctionValue<T>>,
    readonly trigger: (...args: Args) => void,
    readonly forceTrigger: (...args: Args) => void,
    readonly clear: () => void,
}

export function useSharedFunction <T, Args extends unknown[], S extends string = string>(key: S, fn: AFunction<T, Args>, scopeName?: Prefix): SharedFunctionStateReturn<T, Args>;
export function useSharedFunction <T, Args extends unknown[]>(sharedFunctionCreated: SharedFunctionCreated<T, Args>): SharedFunctionStateReturn<T, Args>;
export function useSharedFunction <T, Args extends unknown[], S extends string = string>(
    key: S | SharedFunctionCreated<T, Args>,
    fn?: AFunction<T, Args>,
    scopeName?: Prefix
): SharedFunctionStateReturn<T, Args> {

    let keyStr: string;
    let fnVal!: AFunction<T, Args>;
    let scope: Prefix | undefined = scopeName;

    if (typeof key !== "string") {
        const { key: key2, fn: fn2, prefix: prefix2 } = key;
        keyStr = key2;
        fnVal = fn2;
        scope = prefix2;
    } else {
        keyStr = ensureNonEmptyString(key);
        fnVal = fn as AFunction<T, Args>;
    }
    const {prefix} = useShared(scope);

    sharedFunctionsManager.initValue(keyStr, prefix);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedFunctionValue<T>>>>[0]>(
        () =>
            (listener) => {
                sharedFunctionsManager.initValue(keyStr, prefix);
                sharedFunctionsManager.addListener(keyStr, prefix, listener);

                return () => {
                    sharedFunctionsManager.removeListener(keyStr, prefix, listener);
                }
            },
        []
    );

    const externalStoreSnapshotGetter = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedFunctionValue<T>>>>[1]>(
        () =>
            () =>
                sharedFunctionsManager.get(keyStr, prefix)!.fnState as NonNullable<SharedFunctionValue<T>>,
        []
    );

    const state = useSyncExternalStore<NonNullable<SharedFunctionValue<T>>>(externalStoreSubscriber, externalStoreSnapshotGetter);

    const trigger = async (force: boolean, ...args: Args) => {
        const entry = sharedFunctionsManager.get(keyStr, prefix)!;
        if (!force && (entry.fnState.isLoading || entry.fnState.results !== undefined)) return entry.fnState;
        entry.fnState = { ...entry.fnState, isLoading: true, error: undefined };
        sharedFunctionsManager.callListeners(keyStr, prefix);
        try {
            const results: Awaited<T> = await fnVal(...args);
            entry.fnState = { results, isLoading: false, error: undefined };
        } catch (error) {
            entry.fnState = { ...entry.fnState, isLoading: false, error };
        }
        sharedFunctionsManager.callListeners(keyStr, prefix);
    };

    sharedFunctionsManager.useEffect(keyStr, prefix);

    // noinspection JSUnusedGlobalSymbols
    return {
        state,
        trigger: (...args: Args) => {
            void trigger(false, ...args);
        },
        forceTrigger: (...args: Args) => {
            void trigger(true, ...args);
        },
        clear: () => {
            const entry = sharedFunctionsManager.get(keyStr, prefix);
            if (entry) {
                entry.fnState = sharedFunctionsManager.defaultValue().fnState;
                sharedFunctionsManager.callListeners(keyStr, prefix);
            }
        }
    } as const;
}
