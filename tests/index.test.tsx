import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import React, {useEffect} from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {
    createSharedFunction,
    createSharedState,
    createSharedSubscription,
    sharedFunctionsApi,
    sharedStatesApi,
    SharedStatesProvider,
    sharedSubscriptionsApi,
    useSharedFunction,
    useSharedState,
    useSharedStateSelector,
    useSharedSubscription
} from "../src";
import type {Subscriber, SubscriberEvents} from "../src/hooks/use-shared-subscription";

// Mocking random to have predictable keys for created states/functions/subscriptions
vi.mock('../src/lib/utils', async (importActual) => {
    const actual = await importActual<typeof import('../src/lib/utils')>();
    let count = 0;
    // noinspection JSUnusedGlobalSymbols
    return {
        ...actual,
        random: () => `test-key-${count++}`,
    };
});

beforeEach(() => {
    cleanup();
    // Reset the mocked random key counter
    vi.clearAllMocks();
});
afterEach(() => {
    vi.useRealTimers();
})

describe('useSharedState', () => {
    it('should share state between two components', () => {
        const TestComponent1 = () => {
            const [count] = useSharedState('count', 0);
            return <span data-testid="value1">{count}</span>;
        };

        const TestComponent2 = () => {
            const [count, setCount] = useSharedState('count', 0);
            return (
                <div>
                    <span data-testid="value2">{count}</span>
                    <button onClick={() => setCount(c => c + 1)}>inc</button>
                </div>
            );
        };

        render(
            <>
                <TestComponent1/>
                <TestComponent2/>
            </>
        );

        expect(screen.getByTestId('value1').textContent).toBe('0');
        expect(screen.getByTestId('value2').textContent).toBe('0');

        act(() => {
            fireEvent.click(screen.getByText('inc'));
        });

        expect(screen.getByTestId('value1').textContent).toBe('1');
        expect(screen.getByTestId('value2').textContent).toBe('1');
    });

    it('should isolate state with SharedStatesProvider', () => {
        const TestComponent = () => {
            const [count, setCount] = useSharedState('count', 0);
            return (
                <div>
                    <span>{count}</span>
                    <button onClick={() => setCount(c => c + 1)}>inc</button>
                </div>
            );
        };

        render(
            <div>
                <div data-testid="scope1">
                    <SharedStatesProvider scopeName="scope1">
                        <TestComponent/>
                    </SharedStatesProvider>
                </div>
                <div data-testid="scope2">
                    <SharedStatesProvider scopeName="scope2">
                        <TestComponent/>
                    </SharedStatesProvider>
                </div>
            </div>
        );

        const scope1Button = screen.getAllByText('inc')[0];
        const scope2Button = screen.getAllByText('inc')[1];

        act(() => {
            fireEvent.click(scope1Button);
        });

        expect(screen.getByTestId('scope1').textContent).toContain('1');
        expect(screen.getByTestId('scope2').textContent).toContain('0');

        act(() => {
            fireEvent.click(scope2Button);
            fireEvent.click(scope2Button);
        });

        expect(screen.getByTestId('scope1').textContent).toContain('1');
        expect(screen.getByTestId('scope2').textContent).toContain('2');
    });

    it('should work with createSharedState', () => {
        const sharedCounter = createSharedState(10);

        const TestComponent1 = () => {
            const [count] = useSharedState(sharedCounter);
            return <span data-testid="value1">{count}</span>;
        };

        const TestComponent2 = () => {
            const [count, setCount] = useSharedState(sharedCounter);
            return <button onClick={() => setCount(count + 5)}>inc</button>;
        };

        render(
            <>
                <TestComponent1/>
                <TestComponent2/>
            </>
        );

        expect(screen.getByTestId('value1').textContent).toBe('10');

        act(() => {
            fireEvent.click(screen.getByText('inc'));
        });

        expect(screen.getByTestId('value1').textContent).toBe('15');
    });

    it('should allow direct api manipulation with createSharedState objects', () => {
        const sharedCounter = createSharedState(100);

        // Get initial value
        expect(sharedStatesApi.get(sharedCounter)).toBe(100);

        // Set a new value
        act(() => {
            sharedStatesApi.set(sharedCounter, 200);
        });

        // Get updated value
        expect(sharedStatesApi.get(sharedCounter)).toBe(200);

        // Update the value
        act(() => {
            sharedStatesApi.update(sharedCounter, (prev) => prev + 50);
        });

        // Get updated value after update
        expect(sharedStatesApi.get(sharedCounter)).toBe(250);

        // Clear the value
        act(() => {
            sharedStatesApi.clear(sharedCounter);
        });

        // Get value after clear (should be initial value because createSharedState re-initializes it)
        expect(sharedStatesApi.get(sharedCounter)).toBe(100);
    });

    it('should be able to subscribe to state changes from api', () => {
        const sharedCounter = createSharedState(100);

        const subscribeCallback = vi.fn();

        act(() => {
            sharedStatesApi.subscribe(sharedCounter, () => {
                subscribeCallback();
                expect(sharedStatesApi.get(sharedCounter)).toBe(200);
            });
        });

        // Update the value
        act(() => {
            sharedStatesApi.set(sharedCounter,200);
        });

        expect(subscribeCallback).toHaveBeenCalledTimes(1);
    });
});

describe('useSharedFunction', () => {
    const mockApiCall = vi.fn((...args: any[]) => new Promise(resolve => setTimeout(() => resolve(`result: ${args.join(',')}`), 100)));

    beforeEach(() => {
        mockApiCall.mockClear();
        vi.useFakeTimers();
    });

    const TestComponent = ({fnKey, sharedFn}: { fnKey: string, sharedFn?: any }) => {
        const {state, trigger, forceTrigger, clear} = sharedFn ? useSharedFunction(sharedFn) : useSharedFunction(fnKey, mockApiCall);
        return (
            <div>
                {state.isLoading && <span>Loading...</span>}
                {state.error as any && <span>{String(state.error)}</span>}
                {state.results && <span data-testid="result">{String(state.results)}</span>}
                <button onClick={() => trigger('arg1')}>trigger</button>
                <button onClick={() => forceTrigger('arg2')}>force</button>
                <button onClick={() => clear()}>clear</button>
            </div>
        );
    };

    it('should handle async function lifecycle', async () => {
        render(<TestComponent fnKey="test-fn"/>);

        // Initial state
        expect(screen.queryByText('Loading...')).toBeNull();
        expect(screen.queryByTestId('result')).toBeNull();

        // Trigger
        act(() => {
            fireEvent.click(screen.getByText('trigger'));
        });
        expect(screen.getByText('Loading...')).toBeDefined();

        // Resolve
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(screen.queryByText('Loading...')).toBeNull();
        expect(screen.getByTestId('result').textContent).toBe('result: arg1');
        expect(mockApiCall).toHaveBeenCalledTimes(1);
        expect(mockApiCall).toHaveBeenCalledWith('arg1');
    });

    it('should not trigger if already running or has data', async () => {
        render(<TestComponent fnKey="test-fn"/>);
        act(() => {
            fireEvent.click(screen.getByText('trigger'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(mockApiCall).toHaveBeenCalledTimes(1);

        // Trigger again, should not call mockApiCall
        act(() => {
            fireEvent.click(screen.getByText('trigger'));
        });
        expect(mockApiCall).toHaveBeenCalledTimes(1);
    });

    it('should force trigger', async () => {
        render(<TestComponent fnKey="test-fn"/>);
        act(() => {
            fireEvent.click(screen.getByText('trigger'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(mockApiCall).toHaveBeenCalledTimes(1);

        // Force trigger
        act(() => {
            fireEvent.click(screen.getByText('force'));
        });
        expect(screen.getByText('Loading...')).toBeDefined();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(mockApiCall).toHaveBeenCalledTimes(2);
        expect(mockApiCall).toHaveBeenCalledWith('arg2');
        expect(screen.getByTestId('result').textContent).toBe('result: arg2');
    });

    it('should clear state', async () => {
        render(<TestComponent fnKey="test-fn"/>);
        act(() => {
            fireEvent.click(screen.getByText('trigger'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(screen.getByTestId('result')).toBeDefined();

        act(() => {
            fireEvent.click(screen.getByText('clear'));
        });
        expect(screen.queryByTestId('result')).toBeNull();
    });

    it('should work with createSharedFunction', async () => {
        const sharedFunction = createSharedFunction(mockApiCall);
        render(<TestComponent fnKey="unused" sharedFn={sharedFunction}/>);

        act(() => {
            fireEvent.click(screen.getByText('trigger'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(mockApiCall).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('result').textContent).toBe('result: arg1');
    });

    it('should allow direct api manipulation with createSharedFunction objects', () => {
        const sharedFunction = createSharedFunction(async (arg: string) => `result: ${arg}`);

        // Get initial state
        const initialState = sharedFunctionsApi.get(sharedFunction);
        expect(initialState.results).toBeUndefined();
        expect(initialState.isLoading).toBe(false);
        expect(initialState.error).toBeUndefined();

        // Set a new state
        act(() => {
            sharedFunctionsApi.set(sharedFunction, {
                results: 'test data',
                isLoading: true,
                error: 'test error',
            });
        });

        // Get updated state
        const updatedState = sharedFunctionsApi.get(sharedFunction);
        expect(updatedState.results).toBe('test data');
        expect(updatedState.isLoading).toBe(true);
        expect(updatedState.error).toBe('test error');

        // Update the state
        act(() => {
            sharedFunctionsApi.update(sharedFunction, (prev) => ({
                ...prev,
                results: 'updated data',
            }));
        });

        // Get updated state after update
        const updatedState2 = sharedFunctionsApi.get(sharedFunction);
        expect(updatedState2.results).toBe('updated data');

        // Clear the value
        act(() => {
            sharedFunctionsApi.clear(sharedFunction);
        });

        // Get value after clear (should be initial value)
        const clearedState = sharedFunctionsApi.get(sharedFunction);
        expect(clearedState.results).toBeUndefined();
        expect(clearedState.isLoading).toBe(false);
        expect(clearedState.error).toBeUndefined();
    });
});

describe('useSharedSubscription', () => {
    it('should handle subscription lifecycle', () => {
        const mockSubscriber = vi.fn<Subscriber<string>>((set) => {
            set('initial data');
            return () => {
            };
        });

        const TestComponent = () => {
            const {state: {data}, trigger} = useSharedSubscription('test-sub', mockSubscriber);

            useEffect(() => {
                trigger();
            }, []);

            return <span data-testid="data">{data}</span>;
        };

        render(<TestComponent/>);

        expect(mockSubscriber).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('data').textContent).toBe('initial data');
    });

    it('should allow direct api manipulation with createSharedSubscription objects', () => {
        const mockSubscriber = vi.fn();
        const sharedSubscription = createSharedSubscription(mockSubscriber);

        // Get initial state
        const initialState = sharedSubscriptionsApi.get(sharedSubscription);
        expect(initialState.data).toBeUndefined();
        expect(initialState.isLoading).toBe(false);
        expect(initialState.error).toBeUndefined();

        // Set a new state
        act(() => {
            sharedSubscriptionsApi.set(sharedSubscription, {
                data: 'test data',
                isLoading: true,
                error: 'test error',
            });
        });

        // Get updated state
        const updatedState = sharedSubscriptionsApi.get(sharedSubscription);
        expect(updatedState.data).toBe('test data');
        expect(updatedState.isLoading).toBe(true);
        expect(updatedState.error).toBe('test error');

        // Update the state
        act(() => {
            sharedSubscriptionsApi.update(sharedSubscription, (prev) => ({
                ...prev,
                data: 'updated data',
            }));
        });

        // Get updated state after update
        const updatedState2 = sharedSubscriptionsApi.get(sharedSubscription);
        expect(updatedState2.data).toBe('updated data');

        // Clear the value
        act(() => {
            sharedSubscriptionsApi.clear(sharedSubscription);
        });

        // Get value after clear (should be initial value)
        const clearedState = sharedSubscriptionsApi.get(sharedSubscription);
        expect(clearedState.data).toBeUndefined();
        expect(clearedState.isLoading).toBe(false);
        expect(clearedState.error).toBeUndefined();
    });
});

describe('useSharedSubscription', () => {
    let mockSubscriber: (set: SubscriberEvents.Set<any>, onError: SubscriberEvents.OnError, onCompletion: SubscriberEvents.OnCompletion) => () => void;
    const mockUnsubscribe = vi.fn();

    beforeEach(() => {
        mockUnsubscribe.mockClear();
        mockSubscriber = vi.fn((set, _onError, onCompletion) => {
            // Simulate async subscription
            const timeout = setTimeout(() => {
                set('initial data');
                onCompletion();
            }, 100);
            return () => {
                clearTimeout(timeout);
                mockUnsubscribe();
            };
        });
        vi.useFakeTimers();
    });

    const TestComponent = ({subKey, sharedSub}: { subKey: string, sharedSub?: any }) => {
        const {state, trigger, unsubscribe} = sharedSub ? useSharedSubscription(sharedSub) : useSharedSubscription(subKey, mockSubscriber);
        return (
            <div>
                {state.isLoading && <span>Loading...</span>}
                {state.error && <span>{String(state.error)}</span>}
                {state.data && <span data-testid="data">{String(state.data)}</span>}
                <span>Subscribed: {String(state.subscribed)}</span>
                <button onClick={() => trigger()}>subscribe</button>
                <button onClick={() => unsubscribe()}>unsubscribe</button>
            </div>
        );
    };

    it('should handle subscription lifecycle', async () => {
        render(<TestComponent subKey="test-sub"/>);

        // Initial state
        expect(screen.getByText('Subscribed: false')).toBeDefined();

        // Trigger subscription
        act(() => {
            fireEvent.click(screen.getByText('subscribe'));
        });
        expect(screen.getByText('Loading...')).toBeDefined();

        // Subscription completes
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(screen.queryByText('Loading...')).toBeNull();
        expect(screen.getByTestId('data').textContent).toBe('initial data');
        expect(screen.getByText('Subscribed: true')).toBeDefined();
        expect(mockSubscriber).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe', async () => {
        render(<TestComponent subKey="test-sub"/>);
        act(() => {
            fireEvent.click(screen.getByText('subscribe'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        act(() => {
            fireEvent.click(screen.getByText('unsubscribe'));
        });
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Subscribed: false')).toBeDefined();
    });

    it('should automatically unsubscribe on unmount', async () => {
        const {unmount} = render(<TestComponent subKey="test-sub"/>);
        act(() => {
            fireEvent.click(screen.getByText('subscribe'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        unmount();
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should work with createSharedSubscription', async () => {
        const sharedSubscription = createSharedSubscription(mockSubscriber);
        render(<TestComponent subKey="unused" sharedSub={sharedSubscription}/>);

        act(() => {
            fireEvent.click(screen.getByText('subscribe'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(mockSubscriber).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('data').textContent).toBe('initial data');
    });

    it('should allow direct api manipulation with createSharedSubscription objects', () => {
        const mockSubscriber = vi.fn();
        const sharedSubscription = createSharedSubscription(mockSubscriber);

        // Get initial state
        const initialState = sharedSubscriptionsApi.get(sharedSubscription);
        expect(initialState.data).toBeUndefined();
        expect(initialState.isLoading).toBe(false);
        expect(initialState.error).toBeUndefined();

        // Set a new state
        act(() => {
            sharedSubscriptionsApi.set(sharedSubscription, {
                data: 'test data',
                isLoading: true,
                error: 'test error',
            });
        });

        // Get updated state
        const updatedState = sharedSubscriptionsApi.get(sharedSubscription);
        expect(updatedState.data).toBe('test data');
        expect(updatedState.isLoading).toBe(true);
        expect(updatedState.error).toBe('test error');

        // Update the state
        act(() => {
            sharedSubscriptionsApi.update(sharedSubscription, (prev) => ({
                ...prev,
                data: 'updated data',
            }));
        });

        // Get updated state after update
        const updatedState2 = sharedSubscriptionsApi.get(sharedSubscription);
        expect(updatedState2.data).toBe('updated data');

        // Clear the value
        act(() => {
            sharedSubscriptionsApi.clear(sharedSubscription);
        });

        // Get value after clear (should be initial value)
        const clearedState = sharedSubscriptionsApi.get(sharedSubscription);
        expect(clearedState.data).toBeUndefined();
        expect(clearedState.isLoading).toBe(false);
        expect(clearedState.error).toBeUndefined();
    });
});

describe('useSharedStateSelector', () => {
    const initialState = {a: 1, b: 2, nested: {c: 'hello'}};
    const sharedObjectState = createSharedState(initialState);

    it('should select a slice of state and only re-render when that slice changes', () => {
        const renderSpyA = vi.fn();
        const renderSpyB = vi.fn();

        const ComponentA = () => {
            const a = useSharedStateSelector(sharedObjectState, state => state.a);
            renderSpyA();
            return <span data-testid="a-value">{a}</span>;
        };

        const ComponentB = () => {
            const b = useSharedStateSelector(sharedObjectState, state => state.b);
            renderSpyB();
            return <span data-testid="b-value">{b}</span>;
        };

        const Controller = () => {
            const [state, setState] = useSharedState(sharedObjectState);
            return (
                <div>
                    <button onClick={() => setState(s => ({...s, a: s.a + 1}))}>inc a</button>
                    <button onClick={() => setState(s => ({...s, b: s.b + 1}))}>inc b</button>
                    <span data-testid="full-state">{JSON.stringify(state)}</span>
                </div>
            );
        };

        render(
            <>
                <ComponentA/>
                <ComponentB/>
                <Controller/>
            </>
        );

        // Initial render
        expect(screen.getByTestId('a-value').textContent).toBe('1');
        expect(screen.getByTestId('b-value').textContent).toBe('2');
        expect(renderSpyA).toHaveBeenCalledTimes(1);
        expect(renderSpyB).toHaveBeenCalledTimes(1);

        // Update 'b', only ComponentB should re-render
        act(() => {
            fireEvent.click(screen.getByText('inc b'));
        });

        expect(screen.getByTestId('a-value').textContent).toBe('1');
        expect(screen.getByTestId('b-value').textContent).toBe('3');
        expect(renderSpyA).toHaveBeenCalledTimes(1); // Should not re-render
        expect(renderSpyB).toHaveBeenCalledTimes(2); // Should re-render

        // Update 'a', only ComponentA should re-render
        act(() => {
            fireEvent.click(screen.getByText('inc a'));
        });

        expect(screen.getByTestId('a-value').textContent).toBe('2');
        expect(screen.getByTestId('b-value').textContent).toBe('3');
        expect(renderSpyA).toHaveBeenCalledTimes(2); // Should re-render
        expect(renderSpyB).toHaveBeenCalledTimes(2); // Should not re-render
    });

    it('should work with string keys', () => {
        const renderSpy = vi.fn();
        const key = 'string-key-state';
        sharedStatesApi.set(key, {val: 100});

        const SelectorComponent = () => {
            const val = useSharedStateSelector<{ val: number }, typeof key, number>(key, state => state.val);
            renderSpy();
            return <span data-testid="val">{val}</span>;
        };

        render(<SelectorComponent/>);
        expect(screen.getByTestId('val').textContent).toBe('100');
        expect(renderSpy).toHaveBeenCalledTimes(1);

        // Update state
        act(() => {
            sharedStatesApi.set(key, {val: 200});
        });

        expect(screen.getByTestId('val').textContent).toBe('200');
        expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('should perform deep comparison correctly', () => {
        const renderSpy = vi.fn();
        const nestedState = createSharedState({ a: 1, nested: { c: 'initial' } });

        const NestedSelector = () => {
            const nested = useSharedStateSelector(nestedState, state => state.nested);
            renderSpy();
            return <span data-testid="nested-c">{nested.c}</span>;
        };

        const Controller = () => {
            const [, setState] = useSharedState(nestedState);
            return (
                <div>
                    <button onClick={() => setState(s => ({ ...s, a: s.a + 1 }))}>update outer</button>
                    <button onClick={() => setState(s => ({ ...s, nested: { c: 'updated' } }))}>update inner</button>
                </div>
            );
        };

        render(
            <>
                <NestedSelector />
                <Controller />
            </>
        );

        expect(screen.getByTestId('nested-c').textContent).toBe('initial');
        expect(renderSpy).toHaveBeenCalledTimes(1);

        // Update outer property, should not re-render because the selected object is deep-equal
        act(() => {
            fireEvent.click(screen.getByText('update outer'));
        });
        expect(renderSpy).toHaveBeenCalledTimes(1);

        // Update inner property, should re-render
        act(() => {
            fireEvent.click(screen.getByText('update inner'));
        });
        expect(screen.getByTestId('nested-c').textContent).toBe('updated');
        expect(renderSpy).toHaveBeenCalledTimes(2);
    });
});
