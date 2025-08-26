import type {AFunction, NonEmptyString, PotentialPromise, Prefix} from "../types";
import {useSyncExternalStore} from "react";
import {type SharedApi, SharedData} from "../SharedData";
import useShared from "./use-shared";
import {log} from "../lib/utils";

type Unsubscribe = () => void;
namespace SubscriberEvents{
    export type OnError = (error: unknown) => void;
    export type Set<T> = (value: T) => void
}

type Subscriber<T> = (set: SubscriberEvents.Set<T>, onError: SubscriberEvents.OnError) => PotentialPromise<Unsubscribe | void | undefined>;

type SharedSubscriptionsState<T> = {
    fnState: {
        data?: T;
        isLoading: boolean;
        error?: unknown;
        track: number
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
                track: 0,
            }
        };
    }

    init(key: string, prefix: Prefix) {
        super.init(key, prefix, this.defaultValue());
    }

    setValue<T>(key: string, prefix: Prefix, data: SharedSubscriptionsState<T>) {
        super.setValue(key, prefix, data);
    }

    removeListener(key: string, prefix: Prefix, listener: AFunction) {
        super.removeListener(key, prefix, listener);
        /*const entry = this.get(key, prefix);
        if (entry?.listeners.length === 0) {
            entry.unsubscribe?.();
            entry.unsubscribe = undefined;
        }*/
    }
}

export class SharedSubscriptionsApi implements SharedApi<SharedSubscriptionsState<unknown>>{
    get<T, S extends string = string>(key: NonEmptyString<S>, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        return sharedSubscriptionsData.get(key, prefix)?.fnState as T;
    }
    set<T, S extends string = string>(key: NonEmptyString<S>, fnState: SharedSubscriptionsState<T>, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        sharedSubscriptionsData.setValue(key, prefix, fnState);
    }
    clearAll() {
        sharedSubscriptionsData.clearAll();
    }
    clear(key: string, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        sharedSubscriptionsData.clear(key, prefix);
    }
    has(key: string, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        return Boolean(sharedSubscriptionsData.has(key, prefix));
    }
    getAll() {
        return sharedSubscriptionsData.data;
    }
}

export const sharedSubscriptionsApi = new SharedSubscriptionsApi();

const sharedSubscriptionsData = new SharedSubscriptionsData();

export const useSharedSubscription = <T, S extends string = string>(key: NonEmptyString<S>, subscriber: Subscriber<T>, scopeName?: Prefix) => {

    const {prefix} = useShared(scopeName);

    sharedSubscriptionsData.init(key, prefix);

    const state = useSyncExternalStore<NonNullable<SharedSubscriptionsState<T>['fnState']>>((listener) => {
        sharedSubscriptionsData.init(key, prefix);
        sharedSubscriptionsData.addListener(key, prefix, listener);

        return () => {
            sharedSubscriptionsData.removeListener(key, prefix, listener);
        }
    }, () => sharedSubscriptionsData.get(key, prefix)!.fnState as NonNullable<SharedSubscriptionsState<T>['fnState']>);

    const set = (value: T) => {
        const entry = sharedSubscriptionsData.get(key, prefix)!;
        entry.fnState = { ...entry.fnState, data: value, track: entry.fnState.track + 1 };
        entry.listeners.forEach(l => l());
    }

    const onError = (error: unknown) => {
        const entry = sharedSubscriptionsData.get(key, prefix)!;
        entry.fnState = { ...entry.fnState, isLoading: false, data: undefined, error };
        entry.listeners.forEach(l => l());
    }

    const trigger = async (force: boolean) => {
        const entry = sharedSubscriptionsData.get(key, prefix)!;
        if (force) {
            const unsubscribe = entry.unsubscribe;
            if (unsubscribe) {
                unsubscribe();
                entry.unsubscribe = undefined;
            }
            entry.fnState = { ...entry.fnState, isLoading: false, data: undefined, error: undefined };
        }
        if (entry.fnState.isLoading || entry.fnState.data !== undefined) return entry.fnState;
        log("triggered !!");
        entry.fnState = { ...entry.fnState, isLoading: true, error: undefined };
        entry.listeners.forEach(l => l());
        try {
            entry.unsubscribe = await subscriber(set, onError);
        } catch (error) {
            entry.fnState = { ...entry.fnState, isLoading: false, error };
        }
        entry.listeners.forEach(l => l());
    };

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
            //TODO: think of something
        }
    } as const;
};