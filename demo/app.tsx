import * as React from 'react';
import {useSharedState, SharedStatesProvider} from 'react-shared-states';

const Comp1 = () => {
    const [x, setX] = useSharedState('x', 0);
    const handle = () => {
        setX(x+1)
    }
    return (
        <div>
            <button onClick={() => handle()}>Increment x: {x}</button>
            <h1 className="text-red-600">Comp1</h1>
        </div>
    );
}

const App = () => {

    const [x, setX] = useSharedState('x', 0);
    const [x2, setX2] = useSharedState('x', 0);
    const handle = () => {
        setX(x+1)
    }
    const handle2 = () => {
        setX2(x2+1);
    }

    return (
        <div>
            <h1 className="text-red-600">React shared states Demo</h1>
            <button onClick={() => handle()}>Increment x: {x}</button>
            <br/>
            <button onClick={() => handle2()}>Increment x: {x2}</button>
            <Comp1/>
            <SharedStatesProvider>
                <Comp1/>
                <Comp1/>
                <SharedStatesProvider>
                    <Comp1/>
                    <Comp1/>
                </SharedStatesProvider>
            </SharedStatesProvider>
        </div>
    );
};

export default App;