import type {PotentialPromise, Prefix, SharedCreated, SharedValue} from "../types";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {SharedValuesApi, SharedValuesManager} from "../SharedValuesManager";
import useShared from "./use-shared";
import {ensureNonEmptyString, log} from "../lib/utils";

export type Unsubscribe = () => void;
export namespace SubscriberEvents{
    export type OnError = (error: unknown) => void;
    export type OnCompletion = () => void;
    export type Set<T> = (value: T) => void
}

export type Subscriber<T> = (set: SubscriberEvents.Set<T>, onError: SubscriberEvents.OnError, onCompletion: SubscriberEvents.OnCompletion) => PotentialPromise<Unsubscribe | void | undefined>;

type SharedSubscriptionValue<T> = {
    data?: T;
    isLoading: boolean;
    error?: unknown;
    subscribed?: boolean
}

interface SharedSubscription<T> extends SharedValue {
    fnState: SharedSubscriptionValue<T>,
    unsubscribe?: Unsubscribe | void;
}

class SharedSubscriptionsManager extends SharedValuesManager<SharedSubscription<unknown>, { fnState: SharedSubscriptionValue<unknown> }> {
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

    initValue(key: string, prefix: Prefix, isStatic: boolean = false) {
        super.init(key, prefix, this.defaultValue(), isStatic);
    }

    setValue<T>(key: string, prefix: Prefix, data: { fnState: SharedSubscriptionValue<T> }) {
        super.setValue(key, prefix, data);
    }

    useEffect(key: string, prefix: Prefix) {
        useEffect(() => {
            return () => {
                log(`[${SharedValuesManager.prefix(key, prefix)}]`, "unmount effect2");
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

export class SharedSubscriptionsApi extends SharedValuesApi<SharedSubscription<unknown>, { fnState: SharedSubscriptionValue<unknown> }, SharedSubscriptionValue<unknown>>{
    constructor(sharedSubscriptionsManager: SharedSubscriptionsManager) {
        super(sharedSubscriptionsManager);
    }
    get<T, S extends string = string>(key: S, scopeName?: Prefix): SharedSubscriptionValue<T>;
    get<T>(sharedSubscriptionCreated: SharedSubscriptionCreated<T>): SharedSubscriptionValue<T>;
    get<T, S extends string = string>(key: S | SharedSubscriptionCreated<T>, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            return (super.get(key) as unknown as SharedSubscription<T>)?.fnState;
        }
        return (super.get(key, scopeName) as unknown as SharedSubscription<T>)?.fnState;
    }
    set<T, S extends string = string>(key: S, value: { fnState: SharedSubscriptionValue<T> }, scopeName?: Prefix): void;
    set<T>(sharedSubscriptionCreated: SharedSubscriptionCreated<T>, value: { fnState: SharedSubscriptionValue<T> }): void;
    set<T, S extends string = string>(key: S | SharedSubscriptionCreated<T>, value: { fnState: SharedSubscriptionValue<T> }, scopeName: Prefix = "_global") {
        if (typeof key !== "string") {
            super.set(key, value);
            return;
        }
        super.set(key, value, scopeName);
    }
    update<T, S extends string = string>(key: S, updater: (prev: SharedSubscriptionValue<T>) => { fnState: SharedSubscriptionValue<T> }, scopeName?: Prefix): void;
    update<T>(sharedSubscriptionCreated: SharedSubscriptionCreated<T>, updater: (prev: SharedSubscriptionValue<T>) => { fnState: SharedSubscriptionValue<T> }): void;
    update<T, S extends string = string>(key: S | SharedSubscriptionCreated<T>, updater: (prev: SharedSubscriptionValue<T>) => { fnState: SharedSubscriptionValue<T> }, scopeName: Prefix = "_global") {
        let prev: SharedSubscriptionValue<T>;
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

const sharedSubscriptionsManager = new SharedSubscriptionsManager();

export const sharedSubscriptionsApi = new SharedSubscriptionsApi(sharedSubscriptionsManager);

interface SharedSubscriptionCreated<T> extends SharedCreated{
    subscriber: Subscriber<T>
}

export const createSharedSubscription = <T>(subscriber: Subscriber<T>, scopeName?: Prefix): SharedSubscriptionCreated<T> => {
    return sharedSubscriptionsManager.createStatic<SharedSubscriptionCreated<T>>({subscriber}, scopeName);
}

export type SharedSubscriptionStateReturn<T> = {
    readonly state: NonNullable<SharedSubscriptionValue<T>>,
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

    sharedSubscriptionsManager.initValue(keyStr, prefix);

    const externalStoreSubscriber = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedSubscriptionValue<T>>>>[0]>(
        () =>
            (listener) => {
                sharedSubscriptionsManager.initValue(keyStr, prefix);
                sharedSubscriptionsManager.addListener(keyStr, prefix, listener);

                return () => {
                    sharedSubscriptionsManager.removeListener(keyStr, prefix, listener);
                }
            },
        []
    );

    const externalStoreSnapshotGetter = useMemo<Parameters<typeof useSyncExternalStore<NonNullable<SharedSubscriptionValue<T>>>>[1]>(
        () =>
            () =>
                sharedSubscriptionsManager.get(keyStr, prefix)!.fnState as NonNullable<SharedSubscriptionValue<T>>,
        []
    );


    const state = useSyncExternalStore<NonNullable<SharedSubscriptionValue<T>>>(externalStoreSubscriber, externalStoreSnapshotGetter);

    const set = (value: T) => {
        const entry = sharedSubscriptionsManager.get(keyStr, prefix)!;
        entry.fnState = { ...entry.fnState, data: value };
        sharedSubscriptionsManager.callListeners(keyStr, prefix);
    }

    const onError = (error: unknown) => {
        const entry = sharedSubscriptionsManager.get(keyStr, prefix)!;
        entry.fnState = { ...entry.fnState, isLoading: false, data: undefined, error };
        sharedSubscriptionsManager.callListeners(keyStr, prefix);
    }

    const onComplete = () => {
        const entry = sharedSubscriptionsManager.get(keyStr, prefix)!;
        entry.fnState = { ...entry.fnState, isLoading: false };
        sharedSubscriptionsManager.callListeners(keyStr, prefix);
    }

    const trigger = async (force: boolean) => {
        const entry = sharedSubscriptionsManager.get(keyStr, prefix)!;
        if (force) {
            await sharedSubscriptionsManager.unsubscribe(keyStr, prefix);
            entry.fnState = { ...entry.fnState, isLoading: false, data: undefined, error: undefined, subscribed: false };
        }
        if (entry.fnState.subscribed) return entry.fnState;
        log("triggered !!");
        entry.fnState = { ...entry.fnState, isLoading: true, error: undefined };
        sharedSubscriptionsManager.callListeners(keyStr, prefix);
        try {
            const sub = await subscriberVal(set, onError, onComplete);
            const entry = sharedSubscriptionsManager.get(keyStr, prefix)!;
            entry.unsubscribe = sub;
            entry.fnState.subscribed = true;
        } catch (error) {
            const entry = sharedSubscriptionsManager.get(keyStr, prefix)!;
            entry.fnState = { ...entry.fnState, isLoading: false, error };
        }
        sharedSubscriptionsManager.callListeners(keyStr, prefix);
    };

    sharedSubscriptionsManager.useEffect(keyStr, prefix);

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
            void sharedSubscriptionsManager.unsubscribe(keyStr, prefix);
        }
    } as const;
}
