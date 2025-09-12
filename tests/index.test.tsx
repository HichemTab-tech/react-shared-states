import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest'
import React from 'react'
import {render, screen, fireEvent, act, cleanup} from '@testing-library/react'
import {
    createSharedFunction,
    createSharedState, createSharedSubscription,
    SharedStatesProvider,
    sharedStatesApi,
    useSharedFunction,
    useSharedState,
    useSharedSubscription
} from "../src";
import type {SubscriberEvents} from "../src/hooks/use-shared-subscription";

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

        // Clear the value
        act(() => {
            sharedStatesApi.clear(sharedCounter);
        });

        // Get value after clear (should be initial value because createSharedState re-initializes it)
        expect(sharedStatesApi.get(sharedCounter)).toBe(100);
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
});
