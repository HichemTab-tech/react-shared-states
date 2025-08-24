
# React Shared States

Easily share and synchronize state across React components, with support for both global and scoped states using context providers. This package helps avoid prop drilling and simplifies state management for medium to large React apps.

---


## 🚀 Getting Started

Install via your preferred package manager:

```sh
npm install react-shared-states
```

or, if using pnpm:

```sh
pnpm add react-shared-states
```

---


## 📖 Usage


### Global Shared State

By default, shared states are global. Any component using the same key will share the same state ("tied" together).

```tsx
import { useSharedState } from 'react-shared-states';

function CounterA() {
  const [count, setCount] = useSharedState('counter', 0);
  return <button onClick={() => setCount(c => c + 1)}>A: {count}</button>;
}

function CounterB() {
  const [count, setCount] = useSharedState('counter', 0);
  return <button onClick={() => setCount(c => c + 1)}>B: {count}</button>;
}

function App() {
  return (
    <div>
      {/* Both components share the same state! */}
      <CounterA />
      <CounterB />
    </div>
  );
}
```

> **Note:** Both `CounterA` and `CounterB` use the same key (`'counter'`), so their state is always synchronized. Updating one updates the other instantly.


### Scoped Shared State (using Provider)

Wrap part of your app with `SharedStatesProvider` to scope shared states. States inside the provider are isolated from global/shared states outside. The nearest provider above a component determines its scope.

```tsx
import {SharedStatesProvider, useSharedState} from 'react-shared-states';

function CounterA() {
  const [count, setCount] = useSharedState('counter', 0);
  return <button onClick={() => setCount(c => c + 1)}>A: {count}</button>;
}

function CounterB() {
  const [count, setCount] = useSharedState('counter', 0);
  return <button onClick={() => setCount(c => c + 1)}>B: {count}</button>;
}

function ScopedCounter() {
  const [count, setCount] = useSharedState('counter', 0);
  return <button onClick={() => setCount(c => c + 1)}>Scoped: {count}</button>;
}

function App() {
  return (
    <div>
      {/* These two share the global state */}
      <CounterA/>
      <CounterB/>

      {/* This one is scoped and isolated from the above */}
      <SharedStatesProvider>
        <ScopedCounter/>
      </SharedStatesProvider>
    </div>
  );
}
```

> **Note:**
> - `CounterA` and `CounterB` share the same state (global).
> - `ScopedCounter` inside `SharedStatesProvider` has its own isolated state, independent from the global one.
> - If you nest multiple providers, each component uses the state from the nearest provider above it in the tree.

---


## ⚙️ API Reference

### `useSharedState(key, initialValue)`

Creates a shared state by key. Returns `[value, setValue]` tuple. States are global unless used inside a `SharedStatesProvider`, which scopes them locally.

**Parameters:**

| Parameter      | Type   | Description                     |
|----------------|--------|---------------------------------|
| `key`          | string | Unique key for the shared state |
| `initialValue` | any    | Initial value for the state     |

**Returns:**

- `[value, setValue]`: Current value and setter function

**Example:**

```tsx
const [theme, setTheme] = useSharedState('theme', 'light');
```

### `SharedStatesProvider`

Scopes shared states to its children. States inside are isolated from global states.

**Example:**

```tsx
<SharedStatesProvider>
  <YourComponent />
</SharedStatesProvider>
```

---


## 🤝 Contributions

We welcome contributions!
If you'd like to improve `react-shared-states`,
feel free to [open an issue](https://github.com/HichemTab-tech/react-shared-states/issues) or [submit a pull request](https://github.com/HichemTab-tech/react-shared-states/pulls).

---

## Author

- [@HichemTab-tech](https://www.github.com/HichemTab-tech)

## License

[MIT](https://github.com/HichemTab-tech/react-shared-states/blob/master/LICENSE)

## 🌟 Acknowledgements

Special thanks to the open-source community and early adopters of `react-shared-states` for their feedback, which helped expand support to Webpack alongside Vite.