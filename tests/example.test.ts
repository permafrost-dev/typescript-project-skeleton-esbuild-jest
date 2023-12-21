/* eslint-disable no-undef */

import { add } from '@/index.js';

test('two plus two is four', () => {
    expect(2 + 2).toBe(4);
});

test('adding two plus two is four', () => {
    expect(add(2, 2)).toBe(4);
});
