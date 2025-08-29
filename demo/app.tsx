import * as React from 'react';
import {
    sharedFunctionsApi, sharedStatesApi,
    SharedStatesProvider,
    sharedSubscriptionsApi,
    useSharedFunction,
    useSharedState,
    useSharedSubscription
} from 'react-shared-states';
import './FakeSharedEmitter';
import {FakeSharedEmitter} from "./FakeSharedEmitter";
import {useEffect, useState} from "react";

FakeSharedEmitter.intervalDuration = 3000;
window.sharedSubscriptionsApi = sharedSubscriptionsApi;
window.sharedFunctionsApi = sharedFunctionsApi;
window.sharedStatesApi = sharedStatesApi;

sharedStatesApi.set("x", 55);

const Comp1 = () => {
    const [x, setX] = useSharedState('x', 0);
    const handle = (by = 1) => {
        setX(x+by)
    }

    const {state, trigger, forceTrigger} = useSharedFunction("tt", (logMessage: string) => new Promise((resolve) => {
        console.log("starting...")
        setTimeout(() => {
            console.log("Logged message: ", logMessage)
            resolve(logMessage);
        }, 1000);
    }), "_global");

    return (
        <div>
            <button onClick={() => handle()}>Increment x: {x}</button>
            <button onClick={() => handle(-1)}>Decrement x: {x}</button>
            {state.isLoading && <p>Loading...</p>}
            <button onClick={() => trigger("Hello world")}>Hello</button>
            <button onClick={() => forceTrigger("Hello world")}>Force Hello</button>
            <h1 className="text-red-600">Comp1</h1>
        </div>
    );
}

const use = () => {
    return useSharedSubscription<string>('test-sub', (set, onError, onCompletion) => {

        return FakeSharedEmitter.subscribe("x", (data: string) => {
            if (data === "do-error") {
                onError(new Error("Error"));
                return;
            }
            set(data);
            console.log("data loaded...", data);
        }, onError, onCompletion)

    });
}

const Comp2 = () => {
    const {state, trigger, unsubscribe} = use();


    return (
        <div>
            <h1 className="text-red-600">Comp2 - {state.isLoading && "loading"}</h1>
            <button onClick={() => trigger()}>subscribe</button>
            <button onClick={() => unsubscribe()}>unsubscribe</button>
            results: {state.data}
            <br/>
        </div>
    )
}

const App = () => {

    const [hide, setHide] = useState(false);
    const [x, setX] = useSharedState('x', 0);
    //const [x, setX] = useState(0);
    const handle = () => {
        setX(x+1)
    }

    useEffect(() => {
        window.hide = () => setHide(a => !a);
    }, []);

    if (hide) return null;

    return (
        <div>
            <h1 className="text-red-600">React shared states Demo</h1>
            <button onClick={() => handle()}>Increment x: {x}</button>
            <br/>
            <Comp1/>
            <SharedStatesProvider scopeName="aaa">
                <Comp1/>
                {x > 1 && <Comp1/>}
                {x > 3 && <Comp2/>}
                {x > 6 && <Comp2/>}
            </SharedStatesProvider>

            <SharedStatesProvider>
                <Comp1/>
                <Comp1/>
            </SharedStatesProvider>
        </div>
    );
};

export default App;