// test/customErrorCode.js

import { keccak256, toUtf8Bytes } from 'ethers/lib/utils.js';

const errors = [
    "NotEnoughProfit()",
    "InvalidToken()",
    "UnauthorizedCaller()",
    // Agrega aquí todos los errores que tengas en tu contrato
];

errors.forEach(err => {
    const selector = keccak256(toUtf8Bytes(err)).slice(0, 10);
    console.log(`${err} => ${selector}`);
});

