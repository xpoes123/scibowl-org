import { useState } from "react"

type Counter = {
    count: number;
}

export function moveCounter({ count }: Counter) {
    const [counter, setCounter] = useState(0);
    return (
        <div>
            <p>Count: {counter}</p>
            <button onClick={() => setCounter(counter + 1)}>Increment</button>
            <button onClick={() => setCounter(counter - 1)}>Decrement</button>
        </div>
    )
}