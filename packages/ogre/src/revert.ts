import {Operation, AddOperation, MoveOperation, RemoveOperation, ReplaceOperation} from "fast-json-patch";
import {compileJSONPointer, existsIn, getIn, JSONPath, parseFrom, parsePath} from "immutable-json-patch";

/**
 * Create the inverse of a set of json patch operations
 * @param document
 * @param operations Array with JSON patch actions
 * @return Returns the operations to revert the changes
 */
export function revertJSONPatch<T, U>(document: T, operations: Operation[]): Operation[] {
    let allRevertOperations: Operation[] = []

    for (const operation of operations) {
        let revertOperations: Operation[]
        const path = parsePath(document, operation.path)
        if (operation.op === 'add') {
            revertOperations = revertAdd(document, path)
        } else if (operation.op === 'remove') {
            revertOperations = revertRemove(document, path)
        } else if (operation.op === 'replace') {
            revertOperations = revertReplace(document, path)
        } else if (operation.op === 'copy') {
            revertOperations = revertCopy(document, path)
        } else if (operation.op === 'move') {
            revertOperations = revertMove(document, path, parseFrom(operation.from))
        } else if (operation.op === '_get') {
            revertOperations = []
        } else {
            throw new Error('Unknown JSONPatch operation ' + JSON.stringify(operation))
        }
        allRevertOperations = revertOperations.concat(allRevertOperations)
    }

    return allRevertOperations
}

function revertReplace<T>(document: T, path: JSONPath): [ReplaceOperation<T>] {
    return [{
        op: 'replace',
        path: compileJSONPointer(path),
        // @ts-ignore
        value: getIn(document, path)
    }]
}

function revertRemove<T>(document: T, path: JSONPath): [AddOperation<T>] {
    return [{
        op: 'add',
        path: compileJSONPointer(path),
        // @ts-ignore
        value: getIn(document, path)
    }]
}

function revertAdd<T>(document: T, path: JSONPath): [RemoveOperation] | [ReplaceOperation<T>] {
    if (isArrayItem(document, path) || !existsIn(document, path)) {
        return [{
            op: 'remove',
            path: compileJSONPointer(path)
        }]
    } else {
        return revertReplace(document, path)
    }
}

function revertCopy<T>(document: T, path: JSONPath): [RemoveOperation] | [ReplaceOperation<T>] {
    return revertAdd(document, path)
}

function revertMove<T>(document: T, path: JSONPath, from: JSONPath): [ReplaceOperation<T>] | [MoveOperation] | [MoveOperation, AddOperation<T>] {
    if (path.length < from.length && startsWith(from, path)) {
        // replacing the parent with the child
        return [
            {
                op: 'replace',
                path: compileJSONPointer(path),
                value: document
            }
        ]
    }

    const move: MoveOperation = {
        op: 'move',
        from: compileJSONPointer(path),
        path: compileJSONPointer(from)
    }

    if (!isArrayItem(document, path) && existsIn(document, path)) {
        // the move replaces an existing value in an object
        return [
            move,
            ...revertRemove(document, path)
        ]
    } else {
        return [
            move
        ]
    }
}

/**
 * Test whether array1 starts with array2
 * @param array1
 * @param array2
 * @param [isEqual] Optional function to check equality
 */
export function startsWith<T>(array1: Array<T>, array2: Array<T>, isEqual = strictEqual): boolean {
    if (array1.length < array2.length) {
        return false
    }

    for (let i = 0; i < array2.length; i++) {
        if (!isEqual(array1[i], array2[i])) {
            return false
        }
    }

    return true
}

/**
 * Get all but the last items from an array
 */
// TODO: write unit tests
export function initial<T>(array: Array<T>): Array<T> {
    return array.slice(0, array.length - 1)
}

export function isArrayItem(document: unknown, path: JSONPath): document is Array<unknown> {
    if (path.length === 0) {
        return false
    }

    const parent = getIn(document, initial(path))

    return Array.isArray(parent)
}

/**
 * Test whether two values are strictly equal
 */
export function strictEqual(a: unknown, b: unknown): boolean {
    return a === b
}