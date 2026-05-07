//按需打包
import './useAll'
import { add } from './utils'
import trim from 'lodash/trim'
//  or
// const trim = require('lodash/trim.js')

console.log(trim(' 123123 '))
console.log('utils', add(1, 2))