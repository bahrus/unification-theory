# TypeScript Modeling for AttrPatterns

## Overview

This document explains how to model user-defined attribute patterns in TypeScript with full type safety and inference, based on the approach in `experiment.ts`.

## The Challenge

We want to allow users to define attribute patterns declaratively like this:

```typescript
const patterns = {
    base: 'greetings',
    a: '${base}:hello',           // Resolves to 'greetings:hello'
    b: '${a}--i-am-well',         // Resolves to 'greetings:hello--i-am-well'
    _a: { instanceOf: 'String', mapsTo: 'hello' },
    _b: { instanceOf: 'Boolean', mapsTo: 'wellBeing' }
};
```

The challenges are:
1. TypeScript needs to understand the user-defined properties (`a`, `b`, etc.)
2. Template variable references (`${base}`, `${a}`) should be validated
3. Type inference should work for the spawned class's `initVals`
4. Support JSON serialization (string-based `instanceOf`)

## Solution Architecture

### 1. Core Interfaces

```typescript
interface AttrPattern<T = any> {
    instanceOf?: 'Object' | 'String' | 'Number' | 'Boolean' | 'Array' 
                | typeof Object | typeof String | typeof Number | typeof Boolean | typeof Array;
    mapsTo: '.' | keyof T;
    parser?: (attrValue: string | null) => any;
    initialOnly?: boolean;
}

interface AttrPatterns<T = any> {
    base: string;
    _base: AttrPattern<T>;
    [key: string]: string | AttrPattern<T>;
}
```

### 2. Type Inference

Extract user-defined properties and infer their types:

```typescript
type UserDefinedKeys<T> = {
    [K in keyof T]: K extends `_${string}` ? never : K extends 'base' ? never : K
}[keyof T];

type InferredProperties<T> = {
    [K in UserDefinedKeys<T>]: T[K] extends string 
        ? (T extends Record<`_${K & string}`, AttrPattern<any>> 
            ? (T[`_${K & string}`] extends AttrPattern<any>
                ? (T[`_${K & string}`]['instanceOf'] extends 'String' ? string
                    : T[`_${K & string}`]['instanceOf'] extends 'Number' ? number
                    : T[`_${K & string}`]['instanceOf'] extends 'Boolean' ? boolean
                    : any)
                : any)
            : any)
        : never
};
```

### 3. Template Variable Validation

Validate that template variables reference defined properties:

```typescript
type ExtractVars<S extends string> = 
    S extends `${infer _Start}\${${infer Var}}${infer Rest}`
        ? Var | ExtractVars<Rest>
        : never;

type ValidateRefs<T, K extends keyof T> = 
    T[K] extends string
        ? HasTemplateVars<T[K]> extends true
            ? ExtractVars<T[K]> extends keyof T
                ? true
                : false
            : true
        : true;
```

### 4. Type-Safe Builder

```typescript
function createAttrPatterns<const T extends ValidatedAttrPatterns<T>>(
    patterns: T
): T {
    return patterns;
}

const patterns = createAttrPatterns({
    base: 'greetings',
    _base: { instanceOf: 'Object' as const, mapsTo: '.' as const },
    a: '${base}:hello',
    _a: { instanceOf: 'String' as const, mapsTo: 'hello' as const },
    b: '${a}--i-am-well',
    _b: { instanceOf: 'Boolean' as const, mapsTo: 'wellBeing' as const },
});
```

## Runtime Implementation

### Template Resolution

```typescript
function resolveTemplate(template: string, patterns: Record<string, any>): string {
    return template.replace(/\$\{(\w+)\}/g, (_, varName) => {
        const value = patterns[varName];
        if (typeof value === 'string') {
            return resolveTemplate(value, patterns); // Recursive
        }
        return varName;
    });
}
```

### Compilation to Array Format

```typescript
function compileAttrPatterns<T>(patterns: AttrPatterns<T>): Array<{
    attrName: string;
    propName: string | '.';
    parser: (value: string | null) => any;
    initialOnly: boolean;
}> {
    const result = [];
    
    for (const key in patterns) {
        if (key === 'base' || key.startsWith('_')) continue;
        
        const template = patterns[key];
        const config = patterns[`_${key}`];
        
        if (typeof template === 'string' && config) {
            result.push({
                attrName: resolveTemplate(template, patterns),
                propName: config.mapsTo === '.' ? '.' : String(config.mapsTo),
                parser: getParser(config.instanceOf),
                initialOnly: config.initialOnly ?? true
            });
        }
    }
    
    return result;
}
```

## Integration with IBaseRegistryItem

### Extended Interface

```typescript
interface IBaseRegistryItemWithPatterns<T = any> {
    spawn: { new (oElement?: Element, ctx?: any, initVals?: Partial<T>): T };
    map: { [key: string | symbol]: keyof T };
    enhKey?: string;
    lifecycleKeys?: {
        dispose?: string;
        resolved?: string;
    };
    // Support both compiled and declarative patterns
    attrPatterns?: Array<{
        attrName: string;
        propName: string | '.';
        parser: (value: string | null) => any;
        initialOnly: boolean;
    }> | AttrPatterns<T>;
}
```

### Normalization Helper

```typescript
function normalizeAttrPatterns<T>(
    patterns: IBaseRegistryItemWithPatterns<T>['attrPatterns']
): Array<{...}> {
    if (!patterns) return [];
    if (Array.isArray(patterns)) return patterns;
    return compileAttrPatterns(patterns); // Compile declarative to array
}
```

## Usage Examples

### Example 1: Simple Patterns

```typescript
class ButtonEnhancement {
    count: number = 0;
    label: string = '';
}

const patterns = createAttrPatterns({
    base: 'data',
    _base: { instanceOf: 'Object', mapsTo: '.' },
    count: '${base}-count',
    _count: { instanceOf: 'Number', mapsTo: 'count' },
    label: '${base}-label',
    _label: { instanceOf: 'String', mapsTo: 'label' }
});

const registryItem: IBaseRegistryItemWithPatterns<ButtonEnhancement> = {
    spawn: ButtonEnhancement,
    map: {},
    enhKey: 'button',
    attrPatterns: patterns
};
```

### Example 2: Nested Templates

```typescript
const patterns = createAttrPatterns({
    base: 'x',
    _base: { instanceOf: 'Object', mapsTo: '.' },
    level1: '${base}-level1',
    _level1: { instanceOf: 'String', mapsTo: 'l1' },
    level2: '${level1}-level2',
    _level2: { instanceOf: 'String', mapsTo: 'l2' },
    level3: '${level2}-level3',
    _level3: { instanceOf: 'String', mapsTo: 'l3' }
});

// Resolves to:
// level1: 'x-level1'
// level2: 'x-level1-level2'
// level3: 'x-level1-level2-level3'
```

### Example 3: Custom Parsers

```typescript
const patterns = createAttrPatterns({
    base: 'data',
    _base: { instanceOf: 'Object', mapsTo: '.' },
    timestamp: '${base}-timestamp',
    _timestamp: {
        instanceOf: 'Number',
        mapsTo: 'timestamp',
        parser: (v) => v ? new Date(v).getTime() : null
    }
});
```

## Benefits

### 1. Type Safety
- TypeScript validates template variable references
- Catches typos at compile time
- IDE autocomplete for property names

### 2. Declarative Syntax
- Clean, readable pattern definitions
- Template interpolation for DRY patterns
- JSON-serializable (string-based `instanceOf`)

### 3. Flexibility
- Support both declarative and compiled formats
- Custom parsers for complex transformations
- Extensible for future enhancements

### 4. Runtime Efficiency
- Compile once, use many times
- Cached template resolution
- Minimal overhead

## Limitations and Workarounds

### Limitation 1: Type Inference Complexity
The `InferredProperties` type can become complex with many properties.

**Workaround**: Use explicit interface definitions for better IDE performance:

```typescript
interface MyPatterns extends AttrPatterns<MyClass> {
    base: 'data';
    a: '${base}-a';
    _a: AttrPattern<MyClass>;
}
```

### Limitation 2: Template Variable Validation
TypeScript can't fully validate nested template references at compile time.

**Workaround**: Runtime validation in `compileAttrPatterns()`:

```typescript
if (!patterns[varName]) {
    throw new Error(`Undefined variable '${varName}' in template`);
}
```

### Limitation 3: JSON Serialization
Constructor references (`typeof String`) can't be JSON serialized.

**Solution**: Always use string literals (`'String'`) for JSON compatibility.

## Migration from Array Format

### Old Format (Array)
```typescript
attrPatterns: [
    { attrName: 'data-count', propName: 'count', parser: Number },
    { attrName: 'data-label', propName: 'label', parser: String }
]
```

### New Format (Declarative)
```typescript
attrPatterns: createAttrPatterns({
    base: 'data',
    _base: { instanceOf: 'Object', mapsTo: '.' },
    count: '${base}-count',
    _count: { instanceOf: 'Number', mapsTo: 'count' },
    label: '${base}-label',
    _label: { instanceOf: 'String', mapsTo: 'label' }
})
```

Both formats are supported via `normalizeAttrPatterns()`.

## Future Enhancements

1. **Schema Validation**: Validate attribute values against JSON Schema
2. **Bidirectional Binding**: Sync property changes back to attributes
3. **Computed Properties**: Derive values from multiple attributes
4. **Conditional Patterns**: Enable/disable patterns based on conditions
5. **TypeScript Decorators**: Use decorators for even cleaner syntax

## Conclusion

This approach provides a powerful, type-safe way to define attribute patterns that:
- Validates at compile time
- Supports template interpolation
- Works with JSON serialization
- Integrates seamlessly with assign-gingerly

The declarative syntax makes it easy to define complex attribute hierarchies while maintaining full TypeScript type safety.
