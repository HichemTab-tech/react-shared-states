import type {PotentialPromise, Prefix} from "../types";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {SharedApi, SharedData} from "../SharedData";
import useShared from "./use-shared";
import {ensureNonEmptyString, log} from "../lib/utils";

type Unsubscribe = () => void;
export namespace SubscriberEvents{
    export type OnError = (error: unknown) => void;
    export type OnCompletion = () => void;
    export type Set<T> = (value: T) => void
}

type Subscriber<T> = (set: SubscriberEvents.Set<T>, onError: SubscriberEvents.OnError, onCompletion: SubscriberEvents.OnCompletion) => PotentialPromise<Unsubscribe | void | undefined>;

type SharedSubscriptionsState<T> = {
    fnState: {
        data?: T;
        isLoading: boolean;
        error?: unknown;
        subscribed: boolean
    },
    unsubscribe?: Unsubscribe | void;
}

class SharedSubscriptionsData extends SharedData<SharedSubscriptionsState<unknown>> {
    defaultValue() {
        return {
            fnState: {
                data: undefined,
                isLoading: false,
                error: undefined,
                subscribed: false,
            }
        };
    }

    init(key: string, prefix: Prefix) {
        super.init(key, prefix, this.defaultValue());
    }

    setValue<T>(key: string, prefix: Prefix, data: SharedSubscriptionsState<T>) {
        super.setValue(key, prefix, data);
    }

    useEffect(key: string, prefix: Prefix) {
        useEffect(() => {
            return () => {
                log(`[${SharedData.prefix(key, prefix)}]`, "unmount effect2");
                const entry = this.get(key, prefix);
                if (entry?.listeners.length === 0) {
                    void this.unsubscribe(key, prefix);
                }
            }
        }, []);
        super.useEffect(key, prefix);
    }

    async unsubscribe(key: string, prefix: Prefix) {
        const entry = this.get(key, prefix);
        if (entry) {
            if (entry.unsubscribe) {
                entry.unsubscribe();
                entry.unsubscribe = undefined;
            }
            entry.fnState.subscribed = false;
        }
    }
}

export class SharedSubscriptionsApi extends SharedApi<SharedSubscriptionsState<unknown>>{
    get<T, S extends string = string>(key: S, scopeName: Prefix = "_global") {
        key = ensureNonEmptyString(key);
        const prefix: Prefix = scopeName || "_global";
        return sharedSubscriptionsData.get(key, prefix)?.fnState as T;
    }
    set<T, S extends string = string>(key: S, fnState: SharedSubscriptionsState<T>, scopeName: Prefix = "_global") {
        key = ensureNonEmptyString(key);
        const prefix: Prefix = scopeName || "_global";
        sharedSubscriptionsData.setValue(key, prefix, fnState);
    }
}

const sharedSubscriptionsData = new SharedSubscriptionsData();

export const sharedSubscriptionsApi = new SharedSubscriptionsApi(sharedSubscriptionsData);

export const useSharedSubscription = <T, S extends string = string>(key: S, subscriber: Subscriber<T>, scopeName?: Prefix) => {

    key = ensureNonEmptyString(key);

    const {prefix} = useShared(scopeName);

    sharedSubscriptionsData.init(key, prefix);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedSubscriptionsState<T>['fnState']>>>[0]>(
        () =>
            (listener) => {
                sharedSubscriptionsData.init(key, prefix);
                sharedSubscriptionsData.addListener(key, prefix, listener);

                return () => {
                    sharedSubscriptionsData.removeListener(key, prefix, listener);
                }
            },
        []
    );

    const externalStoreSnapshotGetter = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedSubscriptionsState<T>['fnState']>>>[1]>(
        () =>
            () =>
                sharedSubscriptionsData.get(key, prefix)!.fnState as NonNullable<SharedSubscriptionsState<T>['fnState']>,
        []
    );


    const state = useSyncExternalStore<NonNullable<SharedSubscriptionsState<T>['fnState']>>(externalStoreSubscriber, externalStoreSnapshotGetter);

    const set = (value: T) => {
        const entry = sharedSubscriptionsData.get(key, prefix)!;
        entry.fnState = { ...entry.fnState, data: value };
        entry.listeners.forEach(l => l());
    }

    const onError = (error: unknown) => {
        const entry = sharedSubscriptionsData.get(key, prefix)!;
        entry.fnState = { ...entry.fnState, isLoading: false, data: undefined, error };
        entry.listeners.forEach(l => l());
    }

    const onComplete = () => {
        const entry = sharedSubscriptionsData.get(key, prefix)!;
        entry.fnState = { ...entry.fnState, isLoading: false };
        entry.listeners.forEach(l => l());
    }

    const trigger = async (force: boolean) => {
        const entry = sharedSubscriptionsData.get(key, prefix)!;
        if (force) {
            await sharedSubscriptionsData.unsubscribe(key, prefix);
            entry.fnState = { ...entry.fnState, isLoading: false, data: undefined, error: undefined, subscribed: false };
        }
        if (entry.fnState.subscribed) return entry.fnState;
        log("triggered !!");
        entry.fnState = { ...entry.fnState, isLoading: true, error: undefined };
        entry.listeners.forEach(l => l());
        try {
            entry.unsubscribe = await subscriber(set, onError, onComplete);
            entry.fnState.subscribed = true;
        } catch (error) {
            entry.fnState = { ...entry.fnState, isLoading: false, error };
        }
        entry.listeners.forEach(l => l());
    };

    sharedSubscriptionsData.useEffect(key, prefix);

    // noinspection JSUnusedGlobalSymbols
    return {
        state,
        trigger: () => {
            void trigger(false);
        },
        forceTrigger: () => {
            void trigger(true);
        },
        unsubscribe: () => {
            void sharedSubscriptionsData.unsubscribe(key, prefix);
        }
    } as const;
};