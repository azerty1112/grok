'use strict';

const { sanitizeFilename, pickRandom, formatDuration } = require('./utils');

console.log('Testing sanitizeFilename...');
console.assert(sanitizeFilename('abc:<>def.txt') === 'abc___def.txt', 'sanitizeFilename failed');
console.log('Testing pickRandom...');
let arr = [1,2,3,4,5];
let v = pickRandom(arr);
console.assert(arr.includes(v), 'pickRandom failed');
console.log('Testing formatDuration...');
console.assert(formatDuration(65000) === '1:05', 'formatDuration failed');
console.log('All basic tests Passed!');