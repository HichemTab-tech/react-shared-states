import {describe, it, expect, beforeEach, vi} from 'vitest'
import React, {useState} from 'react'
import {render, screen, fireEvent, act, cleanup} from '@testing-library/react'

beforeEach(() => {
    cleanup()
})

function TestComponent() {
    const [count, setCount] = useState(0);
    return (
        <div>
            <span data-testid="value">{count}</span>
            <button onClick={() => setCount((c: number) => c + 1)}>inc</button>
        </div>
    )
}

describe('test Hello BOSS!', () => {
    it('test Hello BOSS!', () => {
        expect("test Hello BOSS!").toBe("test Hello BOSS!")
    })
})
