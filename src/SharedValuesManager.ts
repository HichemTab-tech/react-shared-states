import type {AFunction, Prefix, SharedCreated, SharedValue} from "./types";
import {useEffect} from "react";
import {ensureNonEmptyString, log, random} from "./lib/utils";

export const staticStores: SharedCreated[] = [];

export abstract class SharedValuesManager<T extends SharedValue, V> {
    data = new Map<string, T>();

    defaultValue() : V {
        return {} as V;
    }

    addListener(key: string, prefix: Prefix, listener: AFunction) {
        if (!this.data.has(SharedValuesManager.prefix(key, prefix))) {
            this.data.set(SharedValuesManager.prefix(key, prefix), {
                ...this.defaultValue(),
                listeners: [],
            } as unknown as T);
        }
        this.data.get(SharedValuesManager.prefix(key, prefix))!.listeners.push(listener);
    }

    removeListener(key: string, prefix: Prefix, listener: AFunction) {
        if (this.data.has(SharedValuesManager.prefix(key, prefix))) {
            this.data.get(SharedValuesManager.prefix(key, prefix))!.listeners = this.data.get(SharedValuesManager.prefix(key, prefix))!.listeners.filter((l) => l !== listener);
        }
    }

    callListeners(key: string, prefix: Prefix) {
        if (this.data.has(SharedValuesManager.prefix(key, prefix))) {
            this.data.get(SharedValuesManager.prefix(key, prefix))!.listeners.forEach((listener) => listener());
        }
    }

    init(key: string, prefix: Prefix, data: V, isStatic = false) {
        if (!this.data.has(SharedValuesManager.prefix(key, prefix))) {
            this.data.set(SharedValuesManager.prefix(key, prefix), {
                ...data,
                isStatic,
                listeners: [],
            } as unknown as T);
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
            const [prefix, key] = SharedValuesManager.extractPrefix(mapKey);
            this.clear(key, prefix, withoutListeners, withStatic);
        });
    }

    clear(key: string, prefix: Prefix, withoutListeners = false, withStatic = false) {
        if (!withoutListeners) {
            this.callListeners(key, prefix);
        }
        const data = this.data.get(SharedValuesManager.prefix(key, prefix));
        if (!data) return;
        const backedData = {...data};
        this.data.delete(SharedValuesManager.prefix(key, prefix));
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

    setValue(key: string, prefix: Prefix, data: V) {
        if (this.data.has(SharedValuesManager.prefix(key, prefix))) {
            this.data.set(SharedValuesManager.prefix(key, prefix), {
                ...this.data.get(SharedValuesManager.prefix(key, prefix))!,
                ...data,
            } as unknown as T)
        }
    }

    has(key: string, prefix: Prefix) {
        return this.data.has(SharedValuesManager.prefix(key, prefix)) ? SharedValuesManager.prefix(key, prefix) : (this.data.has(SharedValuesManager.prefix(key, "_global")) ? SharedValuesManager.prefix(key, "_global") : undefined);
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
                log(`[${SharedValuesManager.prefix(key, prefix)}]`, "unmount effect");
                if (this.data.get(SharedValuesManager.prefix(key, prefix))!.listeners?.length === 0) {
                    this.clear(key, prefix);
                }
            }
        }, []);
    }
}

export class SharedValuesApi<T extends SharedValue, V, R = T> {
    constructor(protected sharedData: SharedValuesManager<T, V>) {}

    /**
     * get a value from the shared data
     * @param key
     * @param scopeName
     */
    get<S extends string = string>(key: S, scopeName: Prefix): R;
    get<S extends string = string>(sharedCreated: SharedCreated): R;
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
        const data = this.sharedData.get(keyStr, prefix);
        return data as R;
    }

    /**
     * set a value in the shared data
     * @param key
     * @param value
     * @param scopeName
     */
    set<S extends string = string>(key: S, value: V, scopeName: Prefix): void;
    set<S extends string = string>(sharedCreated: SharedCreated, value: V): void;
    set<S extends string = string>(key: S | SharedCreated, value: V, scopeName?: Prefix) {
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

        this.sharedData.init(keyStr, prefix, value);
        this.sharedData.setValue(keyStr, prefix, value);
        this.sharedData.callListeners(keyStr, prefix);
    }

    /**
     * update a value in the shared data
     * @param key
     * @param updater
     * @param scopeName
     */
    update<S extends string = string>(key: S, updater: (prev: R) => V, scopeName: Prefix): void;
    update<S extends string = string>(sharedCreated: SharedCreated, updater: (prev: R) => V): void;
    update<S extends string = string>(key: S | SharedCreated, updater: (prev: R) => V, scopeName?: Prefix) {

        let prevData;
        if (typeof key === "string") {
            prevData = this.get<S>(key, scopeName as Prefix);
        }
        else{
            prevData = this.get(key);
        }
        const newValue = updater(prevData);

        if (typeof key === "string") {
            this.set(key, newValue, scopeName as Prefix);
        }
        else{
            this.set(key, newValue);
        }
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
            const [prefix, keyWithoutPrefix] = SharedValuesManager.extractPrefix(key);
            if (prefix === prefixToSearch) {
                this.sharedData.clear(keyWithoutPrefix, prefix);
                this.sharedData.callListeners(keyWithoutPrefix, prefix);
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
            const [prefix, keyWithoutPrefix] = SharedValuesManager.extractPrefix(key);
            all[prefix] = all[prefix] || {};
            all[prefix][keyWithoutPrefix] = value;
        });
        return all;
    }
}