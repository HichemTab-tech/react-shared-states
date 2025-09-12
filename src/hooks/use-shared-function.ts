import type {AFunction, Prefix, SharedCreated} from "../types";
import {useMemo, useSyncExternalStore} from "react";
import {SharedApi, SharedData} from "../SharedData";
import useShared from "./use-shared";
import {ensureNonEmptyString} from "../lib/utils";

type SharedFunctionsState<T> = {
    fnState: {
        results?: T;
        isLoading: boolean;
        error?: unknown;
    }
}

class SharedFunctionsData extends SharedData<SharedFunctionsState<unknown>> {
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

    setValue<T>(key: string, prefix: Prefix, data: SharedFunctionsState<T>) {
        super.setValue(key, prefix, data);
    }
}

export class SharedFunctionsApi extends SharedApi<SharedFunctionsState<unknown>>{
    get<T, S extends string = string>(key: S, scopeName?: Prefix): T;
    get<T, Args extends unknown[]>(sharedFunctionCreated: SharedFunctionCreated<T, Args>): T;
    get<T, Args extends unknown[], S extends string = string>(key: S | SharedFunctionCreated<T, Args>, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            return super.get(key)?.fnState as T;
        }
        return super.get(key, scopeName)?.fnState as T;
    }
    set<T, S extends string = string>(key: S, fnState: SharedFunctionsState<T>, scopeName?: Prefix): void;
    set<T, Args extends unknown[]>(sharedFunctionCreated: SharedFunctionCreated<T, Args>, fnState: SharedFunctionsState<T>): void;
    set<T, Args extends unknown[], S extends string = string>(key: S | SharedFunctionCreated<T, Args>, fnState: SharedFunctionsState<T>, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            super.set(key, fnState);
            return;
        }
        super.set(key, fnState, scopeName);
    }
}

const sharedFunctionsData = new SharedFunctionsData();

export const sharedFunctionsApi = new SharedFunctionsApi(sharedFunctionsData);

interface SharedFunctionCreated<T, Args extends unknown[]> extends SharedCreated{
    fn: AFunction<T, Args>
}

export const createSharedFunction = <T, Args extends unknown[]>(fn: AFunction<T, Args>, scopeName?: Prefix): SharedFunctionCreated<T, Args> => {
    return sharedFunctionsData.createStatic<SharedFunctionCreated<T, Args>>({fn}, scopeName);
}

export type SharedFunctionStateReturn<T, Args extends unknown[]> = {
    readonly state: NonNullable<SharedFunctionsState<T>['fnState']>,
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

    sharedFunctionsData.initValue(keyStr, prefix);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedFunctionsState<T>['fnState']>>>[0]>(
        () =>
            (listener) => {
                sharedFunctionsData.initValue(keyStr, prefix);
                sharedFunctionsData.addListener(keyStr, prefix, listener);

                return () => {
                    sharedFunctionsData.removeListener(keyStr, prefix, listener);
                }
            },
        []
    );

    const externalStoreSnapshotGetter = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedFunctionsState<T>['fnState']>>>[1]>(
        () =>
            () =>
                sharedFunctionsData.get(keyStr, prefix)!.fnState as NonNullable<SharedFunctionsState<T>['fnState']>,
        []
    );

    const state = useSyncExternalStore<NonNullable<SharedFunctionsState<T>['fnState']>>(externalStoreSubscriber, externalStoreSnapshotGetter);

    const trigger = async (force: boolean, ...args: Args) => {
        const entry = sharedFunctionsData.get(keyStr, prefix)!;
        if (!force && (entry.fnState.isLoading || entry.fnState.results !== undefined)) return entry.fnState;
        entry.fnState = { ...entry.fnState, isLoading: true, error: undefined };
        entry.listeners.forEach(l => l());
        try {
            const results: Awaited<T> = await fnVal(...args);
            entry.fnState = { results, isLoading: false, error: undefined };
        } catch (error) {
            entry.fnState = { ...entry.fnState, isLoading: false, error };
        }
        entry.listeners.forEach(l => l());
    };

    sharedFunctionsData.useEffect(keyStr, prefix);

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
            const entry = sharedFunctionsData.get(keyStr, prefix);
            if (entry) {
                entry.fnState = sharedFunctionsData.defaultValue().fnState;
                sharedFunctionsData.callListeners(keyStr, prefix);
            }
        }
    } as const;
}