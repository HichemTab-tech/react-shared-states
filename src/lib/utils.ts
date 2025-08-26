export const log = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'development') return;
    console.log(
        '%c[react-shared-states]',
        'color: #007acc; font-weight: bold',
        ...args,
    )
}