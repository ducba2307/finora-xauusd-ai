import { ErrorBoundary, BoundedCandleBuffer } from '../../../src/components/ErrorBoundary'
import { NetworkStateMachine } from '../../../src/services/networkManager'

console.log('Testing BoundedCandleBuffer defensive copying & bounds...')
const buffer = new BoundedCandleBuffer<number>(100)
for (let i = 0; i < 500; i++) {
  buffer.push(i)
}
if (buffer.length !== 100) throw new Error(`Expected buffer.length 100, got ${buffer.length}`)
const items = buffer.getAll()
items.pop() // mutate copy
if (buffer.length !== 100) throw new Error('Defensive copy breached!')
console.log('BoundedCandleBuffer verified: PASS')

console.log('Testing NetworkStateMachine exponential backoff...')
const net = new NetworkStateMachine()
const b0 = net.calculateBackoff(0, { jitter: false })
const b1 = net.calculateBackoff(1, { jitter: false })
const b2 = net.calculateBackoff(2, { jitter: false })
const b3 = net.calculateBackoff(3, { jitter: false })
const b4 = net.calculateBackoff(4, { jitter: false })
const b5 = net.calculateBackoff(5, { jitter: false })
console.log(`Backoffs: ${b0}, ${b1}, ${b2}, ${b3}, ${b4}, ${b5}`)
if (b0 !== 1000 || b1 !== 2000 || b2 !== 4000 || b3 !== 8000 || b4 !== 16000 || b5 !== 16000) {
  throw new Error('Backoff sequence mismatch!')
}
console.log('Exponential backoff verified: PASS')

console.log('Testing ErrorBoundary static lifecycle methods...')
const err = new Error('Test crash')
const derived = ErrorBoundary.getDerivedStateFromError(err)
if (!derived.hasError || derived.error !== err) throw new Error('getDerivedStateFromError failed!')
console.log('ErrorBoundary static lifecycle verified: PASS')
