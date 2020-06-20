import JsoncParser from './lib/umd/main.js';

const {
    createScanner,
    getLocation,
    parse,
    parseTree,
    findNodeAtLocation,
    findNodeAtOffset,
    getNodePath,
    getNodeValue,
    visit,
    stripComments,
    printParseErrorCode,
    format,
    modify,
    applyEdits,
} = JsoncParser;

export {
    createScanner,
    getLocation,
    parse,
    parseTree,
    findNodeAtLocation,
    findNodeAtOffset,
    getNodePath,
    getNodeValue,
    visit,
    stripComments,
    printParseErrorCode,
    format,
    modify,
    applyEdits,
};
