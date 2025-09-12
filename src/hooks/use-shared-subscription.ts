import type {PotentialPromise, Prefix, SharedCreated} from "../types";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {SharedApi, SharedData} from "../SharedData";
import useShared from "./use-shared";
import {ensureNonEmptyString, log, random} from "../lib/utils";

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
            entry.fnState = { ...entry.fnState, subscribed: false };
            this.callListeners(key, prefix);
        }
    }
}

export class SharedSubscriptionsApi extends SharedApi<SharedSubscriptionsState<unknown>>{
    get<T, S extends string = string>(key: S, scopeName: Prefix = "_global") {
        return super.get(key, scopeName)?.fnState as T;
    }
    set<T, S extends string = string>(key: S, fnState: SharedSubscriptionsState<T>, scopeName: Prefix = "_global") {
        super.set(key, fnState, scopeName);
    }
}

const sharedSubscriptionsData = new SharedSubscriptionsData();

export const sharedSubscriptionsApi = new SharedSubscriptionsApi(sharedSubscriptionsData);

interface SharedSubscriptionCreated<T> extends SharedCreated{
    subscriber: Subscriber<T>
}

export const createSharedSubscription = <T, Args extends unknown[]>(subscriber: Subscriber<T>, scopeName?: Prefix): SharedSubscriptionCreated<T> => {
    const prefix: Prefix = scopeName ?? scopeName ?? "_global";

    return {
        key: random(),
        prefix,
        subscriber,
    }
}

export type SharedSubscriptionStateReturn<T> = {
    readonly state: NonNullable<SharedSubscriptionsState<T>['fnState']>,
    readonly trigger: () => void,
    readonly forceTrigger: () => void,
    readonly unsubscribe: () => void,
}

export function useSharedSubscription <T, S extends string = string>(key: S, subscriber: Subscriber<T>, scopeName?: Prefix): SharedSubscriptionStateReturn<T>;
export function useSharedSubscription <T>(sharedSubscriptionCreated: SharedSubscriptionCreated<T>): SharedSubscriptionStateReturn<T>;
export function useSharedSubscription <T, S extends string = string>(
    key: S|SharedSubscriptionCreated<T>,
    subscriber?: Subscriber<T>,
    scopeName?: Prefix
): SharedSubscriptionStateReturn<T> {

    let keyStr: string;
    let subscriberVal!: Subscriber<T>;
    let scope: Prefix | undefined = scopeName;

    if (typeof key !== "string") {
        const { key: key2, subscriber: sub, prefix: prefix2 } = key;
        keyStr = key2;
        subscriberVal = sub;
        scope = prefix2;
    } else {
        keyStr = ensureNonEmptyString(key);
        subscriberVal = subscriber as Subscriber<T>;
    }
    const {prefix} = useShared(scope);

    sharedSubscriptionsData.init(keyStr, prefix);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedSubscriptionsState<T>['fnState']>>>[0]>(
        () =>
            (listener) => {
                sharedSubscriptionsData.init(keyStr, prefix);
                sharedSubscriptionsData.addListener(keyStr, prefix, listener);

                return () => {
                    sharedSubscriptionsData.removeListener(keyStr, prefix, listener);
                }
            },
        []
    );

    const externalStoreSnapshotGetter = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedSubscriptionsState<T>['fnState']>>>[1]>(
        () =>
            () =>
                sharedSubscriptionsData.get(keyStr, prefix)!.fnState as NonNullable<SharedSubscriptionsState<T>['fnState']>,
        []
    );


    const state = useSyncExternalStore<NonNullable<SharedSubscriptionsState<T>['fnState']>>(externalStoreSubscriber, externalStoreSnapshotGetter);

    const set = (value: T) => {
        const entry = sharedSubscriptionsData.get(keyStr, prefix)!;
        entry.fnState = { ...entry.fnState, data: value };
        entry.listeners.forEach(l => l());
    }

    const onError = (error: unknown) => {
        const entry = sharedSubscriptionsData.get(keyStr, prefix)!;
        entry.fnState = { ...entry.fnState, isLoading: false, data: undefined, error };
        entry.listeners.forEach(l => l());
    }

    const onComplete = () => {
        const entry = sharedSubscriptionsData.get(keyStr, prefix)!;
        entry.fnState = { ...entry.fnState, isLoading: false };
        entry.listeners.forEach(l => l());
    }

    const trigger = async (force: boolean) => {
        const entry = sharedSubscriptionsData.get(keyStr, prefix)!;
        if (force) {
            await sharedSubscriptionsData.unsubscribe(keyStr, prefix);
            entry.fnState = { ...entry.fnState, isLoading: false, data: undefined, error: undefined, subscribed: false };
        }
        if (entry.fnState.subscribed) return entry.fnState;
        log("triggered !!");
        entry.fnState = { ...entry.fnState, isLoading: true, error: undefined };
        entry.listeners.forEach(l => l());
        try {
            entry.unsubscribe = await subscriberVal(set, onError, onComplete);
            entry.fnState.subscribed = true;
        } catch (error) {
            entry.fnState = { ...entry.fnState, isLoading: false, error };
        }
        entry.listeners.forEach(l => l());
    };

    sharedSubscriptionsData.useEffect(keyStr, prefix);

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
            void sharedSubscriptionsData.unsubscribe(keyStr, prefix);
        }
    } as const;
}