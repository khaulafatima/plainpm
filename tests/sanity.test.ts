import { getGreeting } from '../src/index.js'

describe('sanity', () => {
  it('formats greeting string correctly', () => {
    const result = getGreeting('PlainPM')
    expect(result).toBe('Hello, PlainPM!')
  })
})
