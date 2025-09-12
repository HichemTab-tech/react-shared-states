import type {AFunction, DataMapValue, Prefix, SharedCreated} from "./types";
import {useEffect} from "react";
import {ensureNonEmptyString, log, random} from "./lib/utils";

export const staticStores: SharedCreated[] = [];

type SharedDataType<T> = DataMapValue & T;

export abstract class SharedData<T> {
    data = new Map<string, SharedDataType<T>>();

    defaultValue() : T {
        return {} as T;
    }

    addListener(key: string, prefix: Prefix, listener: AFunction) {
        if (!this.data.has(SharedData.prefix(key, prefix))) {
            this.data.set(SharedData.prefix(key, prefix), {
                ...this.defaultValue,
                listeners: [],
            } as SharedDataType<T>);
        }
        this.data.get(SharedData.prefix(key, prefix))!.listeners.push(listener);
    }

    removeListener(key: string, prefix: Prefix, listener: AFunction) {
        if (this.data.has(SharedData.prefix(key, prefix))) {
            this.data.get(SharedData.prefix(key, prefix))!.listeners = this.data.get(SharedData.prefix(key, prefix))!.listeners.filter((l) => l !== listener);
        }
    }

    callListeners(key: string, prefix: Prefix) {
        if (this.data.has(SharedData.prefix(key, prefix))) {
            this.data.get(SharedData.prefix(key, prefix))!.listeners.forEach((listener) => listener());
        }
    }

    init(key: string, prefix: Prefix, data: T, isStatic = false) {
        if (!this.data.has(SharedData.prefix(key, prefix))) {
            this.data.set(SharedData.prefix(key, prefix), {
                ...data,
                isStatic,
                listeners: [],
            } as SharedDataType<T>);
        }
    }

    createStatic<X extends SharedCreated>(rest: Omit<X, 'key' | 'prefix'>, scopeName?: Prefix) {
        const prefix: Prefix = scopeName ?? scopeName ?? "_global";

        const staticStoreId = {
            key: random(),
            prefix,
            ...rest
        }

        staticStores.push(staticStoreId);

        this.initStatic(staticStoreId);

        return staticStoreId;
    }

    initStatic(sharedCreated: SharedCreated) {
        const {key, prefix} = sharedCreated;
        this.init(key, prefix, this.defaultValue(), true);
    }

    clearAll(withoutListeners = false, withStatic = false) {
        this.data.forEach((_, mapKey) => {
            const [prefix, key] = SharedData.extractPrefix(mapKey);
            this.clear(key, prefix, withoutListeners, withStatic);
        });
    }

    clear(key: string, prefix: Prefix, withoutListeners = false, withStatic = false) {
        if (!withoutListeners) {
            this.callListeners(key, prefix);
        }
        const data = this.data.get(SharedData.prefix(key, prefix));
        if (!data) return;
        const backedData = {...data};
        this.data.delete(SharedData.prefix(key, prefix));
        if (backedData.isStatic && !withStatic) {
            const store = staticStores.find((s) => s.key === key && s.prefix === prefix);
            if (store) {
                this.initStatic(store);
            }
        }
    }

    get(key: string, prefix: Prefix) {
        let prefixedKey = this.has(key, prefix);
        if (!prefixedKey) return undefined;
        return this.data.get(prefixedKey);
    }

    setValue(key: string, prefix: Prefix, data: T) {
        if (this.data.has(SharedData.prefix(key, prefix))) {
            this.data.set(SharedData.prefix(key, prefix), {
                ...this.data.get(SharedData.prefix(key, prefix))!,
                ...data,
            } as SharedDataType<T>)
        }
    }

    has(key: string, prefix: Prefix) {
        return this.data.has(SharedData.prefix(key, prefix)) ? SharedData.prefix(key, prefix) : (this.data.has(SharedData.prefix(key, "_global")) ? SharedData.prefix(key, "_global") : undefined);
    }

    static prefix(key: string, prefix: Prefix) {
        if (key.includes("//")) throw new Error("key cannot contain '//'");
        return `${prefix}//${key}`;
    }

    static extractPrefix(mapKey: string) {
        return mapKey.split("//");
    }

    useEffect(key: string, prefix: Prefix, unsub: (() => void)|null = null) {
        useEffect(() => {
            return () => {
                unsub?.();
                log(`[${SharedData.prefix(key, prefix)}]`, "unmount effect");
                if (this.data.get(SharedData.prefix(key, prefix))!.listeners?.length === 0) {
                    this.clear(key, prefix);
                }
            }
        }, []);
    }
}

// noinspection JSUnusedGlobalSymbols
export class SharedApi<T>{
    constructor(protected sharedData: SharedData<T>) {}

    /**
     * get a value from the shared data
     * @param key
     * @param scopeName
     */
    get<S extends string = string>(key: S, scopeName: Prefix): T;
    get<S extends string = string>(sharedCreated: SharedCreated): T;
    get<S extends string = string>(key: S | SharedCreated, scopeName?: Prefix) {
        let keyStr: string;
        let scope: Prefix | undefined = scopeName;

        if (typeof key !== "string") {
            const { key: key2, prefix: prefix2 } = key;
            keyStr = key2;
            scope = prefix2;
        } else {
            keyStr = ensureNonEmptyString(key);
        }
        const prefix: Prefix = scope || "_global";
        return this.sharedData.get(keyStr, prefix) as T;
    }

    /**
     * set a value in the shared data
     * @param key
     * @param value
     * @param scopeName
     */
    set<S extends string = string>(key: S, value: T, scopeName: Prefix): void;
    set<S extends string = string>(sharedCreated: SharedCreated, value: T): void;
    set<S extends string = string>(key: S | SharedCreated, value: T, scopeName?: Prefix) {
        let keyStr: string;
        let scope: Prefix | undefined = scopeName;

        if (typeof key !== "string") {
            const { key: key2, prefix: prefix2 } = key;
            keyStr = key2;
            scope = prefix2;
        } else {
            keyStr = ensureNonEmptyString(key);
        }
        const prefix: Prefix = scope || "_global";
        this.sharedData.setValue(keyStr, prefix, value);
    }

    /**
     * clear all values from the shared data
     */
    clearAll() {
        this.sharedData.clearAll();
    }

    /**
     * clear all values from the shared data in a scope
     * @param scopeName
     */
    clearScope(scopeName?: Prefix) {
        const prefixToSearch: Prefix = scopeName || "_global";
        this.sharedData.data.forEach((_, key) => {
            const [prefix] = SharedData.extractPrefix(key);
            if (prefix === prefixToSearch) {
                this.sharedData.clear(key, prefix);
                return;
            }
        });
    }

    /**
     * resolve a shared created object to a value
     * @param sharedCreated
     */
    resolve(sharedCreated: SharedCreated) {
        const {key, prefix} = sharedCreated;
        return this.get(key, prefix);
    }

    /**
     * clear a value from the shared data
     * @param key
     * @param scopeName
     */
    clear(key: string, scopeName: Prefix): void;
    clear(sharedCreated: SharedCreated): void;
    clear(key: string|SharedCreated, scopeName?: Prefix) {
        let keyStr!: string;
        let prefixStr!: string;
        if (typeof key === "string") {
            keyStr = key;
            prefixStr = scopeName || "_global";
        }
        else{
            keyStr = key.key;
            prefixStr = key.prefix;
        }
        this.sharedData.clear(keyStr, prefixStr);
    }

    /**
     * check if a value exists in the shared data
     * @param key
     * @param scopeName
     */
    has(key: string, scopeName: Prefix = "_global") {
        const prefix: Prefix = scopeName || "_global";
        return Boolean(this.sharedData.has(key, prefix));
    }

    /**
     * get all values from the shared data
     */
    getAll() {
        const all: Record<string, Record<string, any>> = {};
        this.sharedData.data.forEach((value, key) => {
            const [prefix, keyWithoutPrefix] = SharedData.extractPrefix(key);
            all[prefix] = all[prefix] || {};
            all[prefix][keyWithoutPrefix] = value;
        });
        return all;
    }
}