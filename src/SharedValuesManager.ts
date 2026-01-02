import type {AFunction, Prefix, SharedCreated, SharedValue} from "./types";
import {useEffect} from "react";
import {ensureNonEmptyString, log, random} from "./lib/utils";

export const staticStores: SharedCreated[] = [];

const MANAGER_KEY = Symbol.for("react-shared-states.manager");

function getManager<T>(instanceKey: string, defaultValue: () => T = () => null as T) {
    const g = globalThis as any;
    if (!g[MANAGER_KEY]) {
        g[MANAGER_KEY] = {};
    }
    if (!g[MANAGER_KEY][instanceKey]) {
        g[MANAGER_KEY][instanceKey] = new SharedValuesManager<T>(defaultValue);
    }
    return g[MANAGER_KEY][instanceKey] as SharedValuesManager<T>;
}

export class SharedValuesManager<T> {
    data = new Map<string, SharedValue<T>>();

    static INSTANCES = new Map<string, SharedValuesManager<any>>();

    constructor(protected defaultValue: () => T = () => null as T) {
    }

    static getInstance<T>(instanceKey: string, defaultValue: () => T = () => null as T): SharedValuesManager<T> {
        return getManager(instanceKey, defaultValue);
    }

    addListener(key: string, prefix: Prefix, listener: AFunction) {
        const fullKey = SharedValuesManager.prefix(key, prefix);
        const entry = this.data.get(fullKey);
        if (entry) {
            entry.listeners.push(listener);
        }
    }

    removeListener(key: string, prefix: Prefix, listener: AFunction) {
        const fullKey = SharedValuesManager.prefix(key, prefix);
        const entry = this.data.get(fullKey);
        if (entry) {
            entry.listeners = entry.listeners.filter((l) => l !== listener);
        }
    }

    callListeners(key: string, prefix: Prefix) {
        const fullKey = SharedValuesManager.prefix(key, prefix);
        const entry = this.data.get(fullKey);
        if (entry) {
            entry.listeners.forEach((listener) => listener());
        }
    }

    init(key: string, prefix: Prefix, initialValue: T, isStatic = false) {
        const fullKey = SharedValuesManager.prefix(key, prefix);
        if (!this.data.has(fullKey)) {
            this.data.set(fullKey, {
                value: initialValue,
                isStatic: isStatic ? isStatic : undefined,
                listeners: [],
            });
        }
    }

    createStatic<X extends SharedCreated>(rest: Omit<X, 'key' | 'prefix'>, initialValue: T, scopeName?: Prefix): X {
        const prefix: Prefix = scopeName ?? "_global";

        const staticStoreId = {
            key: random(),
            prefix,
            ...rest
        }

        staticStores.push(staticStoreId);

        this.init(staticStoreId.key, staticStoreId.prefix, initialValue, true);

        this.defaultValue = () => initialValue;

        return staticStoreId as X;
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
        const fullKey = SharedValuesManager.prefix(key, prefix);
        if (!withoutListeners) {
            this.callListeners(key, prefix);
        }
        const data = this.data.get(fullKey);
        if (!data) return;

        this.data.delete(fullKey);

        if (data.isStatic && !withStatic) {
            const store = staticStores.find((s) => s.key === key && s.prefix === prefix);
            if (store) {
                this.initStatic(store);
            }
        }
    }

    get(key: string, prefix: Prefix): SharedValue<T> | undefined {
        let prefixedKey = this.has(key, prefix);
        if (!prefixedKey) return undefined;
        return this.data.get(prefixedKey);
    }

    setValue(key: string, prefix: Prefix, value: T) {
        const fullKey = SharedValuesManager.prefix(key, prefix);
        const entry = this.data.get(fullKey);
        if (entry) {
            entry.value = value;
            this.data.set(fullKey, entry);
        }
    }

    has(key: string, prefix: Prefix) {
        return this.data.has(SharedValuesManager.prefix(key, prefix)) ? SharedValuesManager.prefix(key, prefix) : (this.data.has(SharedValuesManager.prefix(key, "_global")) ? SharedValuesManager.prefix(key, "_global") : undefined);
    }

    static prefix(key: string, prefix: Prefix) {
        if (key.includes("//")) throw new Error("key cannot contain '//'");
        return `${prefix}//${key}`;
    }

    static extractPrefix(mapKey: string): [Prefix, string] {
        const parts = mapKey.split("//");
        return [parts[0], parts.slice(1).join("//")];
    }

    useEffect(key: string, prefix: Prefix, unsub: (() => void) | null = null) {
        useEffect(() => {
            return () => {
                unsub?.();
                log(`[${SharedValuesManager.prefix(key, prefix)}]`, "unmount effect");
                const entry = this.get(key, prefix);
                if (entry && entry.listeners?.length === 0) {
                    this.clear(key, prefix);
                }
            }
        }, [key, prefix]);
    }
}

export class SharedValuesApi<T> {
    constructor(protected sharedData: SharedValuesManager<T>) {}

    private _get(key: string | SharedCreated, scopeName?: Prefix): { value: T, key: string, prefix: Prefix } {
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
        if (data) {
            return { value: data.value, key: keyStr, prefix };
        }
        return {
            key: keyStr,
            prefix,
            value: undefined as T
        };
    }

    get(key: string, scopeName?: Prefix): T;
    get(sharedCreated: SharedCreated): T;
    get(key: string | SharedCreated, scopeName?: Prefix): T {
        return this._get(key, scopeName).value;
    }

    set(key: string, value: T, scopeName?: Prefix): void;
    set(sharedCreated: SharedCreated, value: T): void;
    set(key: string | SharedCreated, value: T, scopeName?: Prefix) {
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

    update(key: string, updater: (prev: T) => T, scopeName?: Prefix): void;
    update(sharedCreated: SharedCreated, updater: (prev: T) => T): void;
    update(key: string | SharedCreated, updater: (prev: T) => T, scopeName?: Prefix) {
        const data = this._get(key, scopeName);
        if (data) {
            const newValue = updater(data.value);
            this.set(data.key, newValue, data.prefix);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    clearAll() {
        this.sharedData.clearAll();
    }

    // noinspection JSUnusedGlobalSymbols
    clearScope(scopeName?: Prefix) {
        const prefixToSearch: Prefix = scopeName || "_global";
        this.sharedData.data.forEach((_, key) => {
            const [prefix, keyWithoutPrefix] = SharedValuesManager.extractPrefix(key);
            if (prefix === prefixToSearch) {
                this.sharedData.clear(keyWithoutPrefix, prefix);
                this.sharedData.callListeners(keyWithoutPrefix, prefix);
            }
        });
    }

    // noinspection JSUnusedGlobalSymbols
    resolve(sharedCreated: SharedCreated): T | undefined {
        const {key, prefix} = sharedCreated;
        return this.get(key, prefix);
    }

    // noinspection JSUnusedGlobalSymbols
    clear(key: string, scopeName: Prefix): void;
    clear(sharedCreated: SharedCreated): void;
    clear(key: string | SharedCreated, scopeName?: Prefix) {
        let keyStr: string;
        let prefixStr: string;
        if (typeof key === "string") {
            keyStr = key;
            prefixStr = scopeName || "_global";
        } else {
            keyStr = key.key;
            prefixStr = key.prefix;
        }
        this.sharedData.clear(keyStr, prefixStr);
    }

    // noinspection JSUnusedGlobalSymbols
    has(key: string, scopeName: Prefix = "_global"): boolean {
        const prefix: Prefix = scopeName || "_global";
        return !!this.sharedData.has(key, prefix);
    }

    // noinspection JSUnusedGlobalSymbols
    getAll(): Record<string, Record<string, T>> {
        const all: Record<string, Record<string, any>> = {};
        this.sharedData.data.forEach((value, key) => {
            const [prefix, keyWithoutPrefix] = SharedValuesManager.extractPrefix(key);
            all[prefix] = all[prefix] || {};
            all[prefix][keyWithoutPrefix] = value.value;
        });
        return all;
    }

    subscribe(key: string, listener: AFunction, scopeName?: Prefix): () => void;
    subscribe(sharedCreated: SharedCreated, listener: AFunction): () => void;
    subscribe(key: string | SharedCreated, listener: AFunction, scopeName?: Prefix): () => void {
        let keyStr: string;
        let prefixStr: string;
        if (typeof key === "string") {
            keyStr = key;
            prefixStr = scopeName || "_global";
        } else {
            keyStr = key.key;
            prefixStr = key.prefix;
        }
        this.sharedData.addListener(keyStr, prefixStr, listener);
        return () => {
            this.sharedData.removeListener(keyStr, prefixStr, listener);
        }
    }
}