import * as React from 'react';
import {
    createSharedSubscription,
    sharedFunctionsApi, sharedStatesApi,
    SharedStatesProvider,
    sharedSubscriptionsApi,
    useSharedFunction,
    useSharedState, useSharedStateSelector,
    useSharedSubscription
} from 'react-shared-states';
import './FakeSharedEmitter';
import {FakeSharedEmitter} from "./FakeSharedEmitter";
import {useEffect, useState} from "react";
import {createSharedState} from "react-shared-states";

FakeSharedEmitter.intervalDuration = 3000;
window.sharedSubscriptionsApi = sharedSubscriptionsApi;
window.sharedFunctionsApi = sharedFunctionsApi;
window.sharedStatesApi = sharedStatesApi;

sharedStatesApi.set("x", 55);

const counterGlobal = createSharedState(0);

const Comp1 = () => {
    //const [x, setX] = useSharedState('x', 0);
    //const [x, setX] = useSharedState(counterGlobal);
    const [x, setX] = useSharedState("counterGlobal", 0);
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



const s = createSharedSubscription((set, onError, onCompletion) => {

    return FakeSharedEmitter.subscribe("x", (data: string) => {
        if (data === "do-error") {
            onError(new Error("Error"));
            return;
        }
        set(data);
        console.log("data loaded...", data);
    }, onError, onCompletion)

}, {
    initialValue: ""
})

const use = () => {
    return useSharedSubscription(s);
}

const Comp2 = () => {
    const {state: {data, ...state}, trigger, unsubscribe} = use();


    return (
        <div>
            <h1 className="text-red-600">Comp2 - {state.isLoading && "loading"}</h1>
            <button onClick={() => trigger()}>subscribe</button>
            <button onClick={() => unsubscribe()}>unsubscribe</button>
            results: {data}
            <br/>
        </div>
    )
}

const Comp3 = () => {
    const [s, set] = useSharedState("json", {a: 0, b: 0});


    return (
        <div>
            <button onClick={() => set(a => ({...a, a: a.a+1}))}>plus a</button>
            <br/>
            <button onClick={() => set(a => ({...a, b: a.b+1}))}>plus b</button>
            <br/>
            results: {JSON.stringify(s)}
            <br/>
        </div>
    )
}

const Comp4 = () => {
    const a = useSharedStateSelector<{a: number, b: number}, "json", number>("json", (j) => j.a);
    console.log("render a");
    return (
        <div>
            a: {a}
            <br/>
        </div>
    )
}

const Comp5 = () => {
    const a = useSharedStateSelector<{a: number, b: number}, "json", number>("json", (j) => j.b);
    console.log("render b");
    return (
        <div>
            b: {a}
            <br/>
        </div>
    )
}

const App = () => {

    const [hide, setHide] = useState(false);
    const [x, setX] = useSharedState(counterGlobal);
    //const [x, setX] = useSharedState('x', 0);
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
            <br/>
            <br/>
            <br/>
            <Comp3/>
            <Comp4/>
            <Comp5/>
        </div>
    );
};

export default App;