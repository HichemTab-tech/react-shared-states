import type {AFunction, Prefix} from "../types";
import {useMemo, useSyncExternalStore} from "react";
import {type SharedApi, SharedData} from "../SharedData";
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

    init(key: string, prefix: Prefix) {
        super.init(key, prefix, this.defaultValue());
    }

    setValue<T>(key: string, prefix: Prefix, data: SharedFunctionsState<T>) {
        super.setValue(key, prefix, data);
    }
}

export class SharedFunctionsApi implements SharedApi<SharedFunctionsState<unknown>>{
    get<T, S extends string = string>(key: S, scopeName: Prefix = "_global") {
        key = ensureNonEmptyString(key);
        const prefix: Prefix = scopeName || "_global";
        return sharedFunctionsData.get(key, prefix)?.fnState as T;
    }
    set<T, S extends string = string>(key: S, fnState: SharedFunctionsState<T>, scopeName: Prefix = "_global") {
        key = ensureNonEmptyString(key);
        const prefix: Prefix = scopeName || "_global";
        sharedFunctionsData.setValue(key, prefix, fnState);
    }
    clearAll() {
        sharedFunctionsData.clearAll();
    }
    clear(key: string, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        sharedFunctionsData.clear(key, prefix);
    }
    has(key: string, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        return Boolean(sharedFunctionsData.has(key, prefix));
    }
    getAll() {
        return sharedFunctionsData.data;
    }
}

export const sharedFunctionsApi = new SharedFunctionsApi();

const sharedFunctionsData = new SharedFunctionsData();

export const useSharedFunction = <T, Args extends unknown[], S extends string = string>(key: S, fn: AFunction<T, Args>, scopeName?: Prefix) => {

    key = ensureNonEmptyString(key);
    const {prefix} = useShared(scopeName);

    sharedFunctionsData.init(key, prefix);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedFunctionsState<T>['fnState']>>>[0]>(
        () =>
            (listener) => {
                sharedFunctionsData.init(key, prefix);
                sharedFunctionsData.addListener(key, prefix, listener);

                return () => {
                    sharedFunctionsData.removeListener(key, prefix, listener);
                }
            },
        []
    );

    const externalStoreSnapshotGetter = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedFunctionsState<T>['fnState']>>>[1]>(
        () =>
            () =>
                sharedFunctionsData.get(key, prefix)!.fnState as NonNullable<SharedFunctionsState<T>['fnState']>,
        []
    );

    const state = useSyncExternalStore<NonNullable<SharedFunctionsState<T>['fnState']>>(externalStoreSubscriber, externalStoreSnapshotGetter);

    const trigger = async (force: boolean, ...args: Args) => {
        const entry = sharedFunctionsData.get(key, prefix)!;
        if (!force && (entry.fnState.isLoading || entry.fnState.results !== undefined)) return entry.fnState;
        entry.fnState = { ...entry.fnState, isLoading: true, error: undefined };
        entry.listeners.forEach(l => l());
        try {
            const results: Awaited<T> = await fn(...args);
            entry.fnState = { results, isLoading: false, error: undefined };
        } catch (error) {
            entry.fnState = { ...entry.fnState, isLoading: false, error };
        }
        entry.listeners.forEach(l => l());
    };

    sharedFunctionsData.useEffect(key, prefix);

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
            sharedFunctionsData.clear(key, prefix);
            sharedFunctionsData.init(key, prefix);
        }
    } as const;
};