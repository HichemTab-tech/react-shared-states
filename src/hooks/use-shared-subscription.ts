import type {PotentialPromise, Prefix, SharedCreated} from "../types";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {SharedValuesApi, SharedValuesManager} from "../SharedValuesManager";
import useShared from "./use-shared";
import {ensureNonEmptyString, log} from "../lib/utils";

export type Unsubscribe = () => void;
export namespace SubscriberEvents {
    export type OnError = (error: unknown) => void;
    export type OnCompletion = () => void;
    export type Set<T> = (value: T) => void
}

export type Subscriber<T> = (set: SubscriberEvents.Set<T>, onError: SubscriberEvents.OnError, onCompletion: SubscriberEvents.OnCompletion) => PotentialPromise<Unsubscribe | void | undefined>;

export type SharedSubscriptionValue<T> = {
    data?: T;
    isLoading: boolean;
    error?: unknown;
    subscribed?: boolean
}

interface SharedSubscription<T> extends SharedSubscriptionValue<T> {
    unsubscribe?: Unsubscribe | void;
}

const sharedSubscriptionsManager = new SharedValuesManager<SharedSubscription<any>>(() => defaultValue);
export const sharedSubscriptionsApi = new SharedValuesApi<SharedSubscription<any>>(sharedSubscriptionsManager);

interface SharedSubscriptionCreated<T> extends SharedCreated {
    subscriber: Subscriber<T>
}

const defaultValue: SharedSubscription<any> = {
    data: undefined,
    isLoading: false,
    error: undefined,
    subscribed: false,
    unsubscribe: undefined,
};

export const createSharedSubscription = <T>(subscriber: Subscriber<T>, scopeName?: Prefix): SharedSubscriptionCreated<T> => {
    return sharedSubscriptionsManager.createStatic<SharedSubscriptionCreated<T>>({subscriber}, defaultValue, scopeName);
}

export type SharedSubscriptionStateReturn<T> = {
    readonly state: NonNullable<SharedSubscriptionValue<T>>,
    readonly trigger: () => void,
    readonly forceTrigger: () => void,
    readonly unsubscribe: () => void,
}

async function unsubscribe(key: string, prefix: Prefix) {
    const entry = sharedSubscriptionsManager.get(key, prefix);
    if (entry?.value.unsubscribe) {
        (entry.value.unsubscribe as Unsubscribe)();
        sharedSubscriptionsApi.update(key, (prev) => ({...prev, unsubscribe: undefined, subscribed: false}), prefix);
    }
}

export function useSharedSubscription<T, S extends string = string>(key: S, subscriber: Subscriber<T>, scopeName?: Prefix): SharedSubscriptionStateReturn<T>;
export function useSharedSubscription<T>(sharedSubscriptionCreated: SharedSubscriptionCreated<T>): SharedSubscriptionStateReturn<T>;
export function useSharedSubscription<T, S extends string = string>(
    key: S | SharedSubscriptionCreated<T>,
    subscriber?: Subscriber<T>,
    scopeName?: Prefix
): SharedSubscriptionStateReturn<T> {

    let keyStr: string;
    let subscriberVal!: Subscriber<T>;
    let scope: Prefix | undefined = scopeName;

    if (typeof key !== "string") {
        const {key: key2, subscriber: sub, prefix: prefix2} = key;
        keyStr = key2;
        subscriberVal = sub;
        scope = prefix2;
    } else {
        keyStr = ensureNonEmptyString(key);
        subscriberVal = subscriber as Subscriber<T>;
    }
    const {prefix} = useShared(scope);

    sharedSubscriptionsManager.init(keyStr, prefix, defaultValue);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedSubscriptionValue<T>>>>[0]>(
        () =>
            (listener) => {
                sharedSubscriptionsManager.init(keyStr, prefix, defaultValue);
                sharedSubscriptionsManager.addListener(keyStr, prefix, listener);

                return () => {
                    sharedSubscriptionsManager.removeListener(keyStr, prefix, listener);
                }
            },
        [keyStr, prefix]
    );

    const externalStoreSnapshotGetter = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedSubscriptionValue<T>>>>[1]>(
        () =>
            () => {
                const value = sharedSubscriptionsManager.get(keyStr, prefix)!.value;
                return value as NonNullable<SharedSubscriptionValue<T>>;
            },
        [keyStr, prefix]
    );

    const state = useSyncExternalStore<NonNullable<SharedSubscriptionValue<T>>>(externalStoreSubscriber, externalStoreSnapshotGetter);

    const set = (value: T) => {
        sharedSubscriptionsApi.update(keyStr, (prev) => ({...prev, data: value}), prefix);
    }

    const onError = (error: unknown) => {
        sharedSubscriptionsApi.update(keyStr, (prev) => ({...prev, isLoading: false, data: undefined, error}), prefix);
    }

    const onComplete = () => {
        sharedSubscriptionsApi.update(keyStr, (prev) => ({...prev, isLoading: false}), prefix);
    }

    const trigger = async (force: boolean) => {
        const entry = sharedSubscriptionsManager.get(keyStr, prefix)!;
        if (force) {
            await unsubscribe(keyStr, prefix);
        }
        if (entry.value.subscribed && !force) return entry.value;
        log("triggered !!");
        sharedSubscriptionsApi.update(keyStr, (prev) => ({...prev, isLoading: true, error: undefined}), prefix);
        try {
            const sub = await subscriberVal(set, onError, onComplete);
            sharedSubscriptionsApi.update(keyStr, (prev) => ({...prev, unsubscribe: sub, subscribed: true, isLoading: false}), prefix);
        } catch (error) {
            sharedSubscriptionsApi.update(keyStr, (prev) => ({...prev, isLoading: false, error}), prefix);
        }
    };

    useEffect(() => {
        return () => {
            log(`[${SharedValuesManager.prefix(keyStr, prefix)}]`, "unmount effect2");
            const entry = sharedSubscriptionsManager.get(keyStr, prefix);
            if (entry?.listeners.length === 0) {
                void unsubscribe(keyStr, prefix);
            }
        }
    }, [keyStr, prefix]);

    sharedSubscriptionsManager.useEffect(keyStr, prefix);

    return {
        state,
        trigger: () => {
            void trigger(false);
        },
        forceTrigger: () => {
            void trigger(true);
        },
        unsubscribe: () => {
            void unsubscribe(keyStr, prefix);
        }
    } as const;
}
