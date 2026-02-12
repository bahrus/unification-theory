/**
 * Base interface for attribute pattern configuration
 */
interface AttrConfig<T = any> {
    /**
     * Type hint for parsing the attribute value
     */
    instanceOf?: 'Object' | 'String' | 'Number' | 'Boolean' | 'Array' | typeof Object | typeof String | typeof Number | typeof Boolean | typeof Array;
    
    /**
     * Property name on the spawned class instance to map to
     * "." means do an assign-gingerly into the entire spawned class
     */
    mapsTo?: '.' | keyof T;
    
    /**
     * Custom parser function to transform attribute string value
     */
    parser?: (attrValue: string | null) => any;
    
    /**
     * Whether to only read the initial value (true) or continue observing changes (false)
     */
    initialOnly?: boolean;
}

/**
 * Helper type to extract user-defined property names from AttrPatterns
 * Filters out properties that start with underscore or are named 'base'
 */
type UserDefinedKeys<T> = {
    [K in keyof T]: K extends `_${string}` ? never : K extends 'base' ? never : K
}[keyof T];

/**
 * Helper type to build the shape of user-defined properties
 * Maps each user property to its corresponding _property config
 */
type InferredProperties<T> = {
    [K in UserDefinedKeys<T>]: T[K] extends string 
        ? (T extends Record<`_${K & string}`, AttrPattern<any>> 
            ? (T[`_${K & string}`] extends AttrPattern<any>
                ? (T[`_${K & string}`]['instanceOf'] extends 'String' | typeof String ? string
                    : T[`_${K & string}`]['instanceOf'] extends 'Number' | typeof Number ? number
                    : T[`_${K & string}`]['instanceOf'] extends 'Boolean' | typeof Boolean ? boolean
                    : T[`_${K & string}`]['instanceOf'] extends 'Array' | typeof Array ? any[]
                    : T[`_${K & string}`]['instanceOf'] extends 'Object' | typeof Object ? Record<string, any>
                    : any)
                : any)
            : any)
        : never
};

/**
 * Main AttrPatterns interface with type inference
 * T is the spawned class type
 * The interface allows user-defined properties with their configs
 */
interface AttrPatterns<T = any> {
    /**
     * Base attribute name (e.g., 'greetings')
     */
    base: string;
    
    /**
     * Configuration for the base attribute
     */
    _base: AttrConfig<T>;
    
    /**
     * User-defined attribute patterns
     * Each property 'x' should have a corresponding '_x' config
     */
    [key: string]: string | AttrConfig<T>;
}

/**
 * Type-safe builder for AttrPatterns with inference
 */
function defineAttrPatterns<const T extends AttrPatterns>(patterns: T): T & { 
    __inferred: InferredProperties<T> 
} {
    return patterns as any;
}

// Example usage with type inference
const attrPatterns = defineAttrPatterns({
    base: 'greetings',
    _base: {
        instanceOf: 'Object',
        mapsTo: '.', 
    },
    // Supports attribute 'greetings:hello'
    a: '${base}:hello',
    _a: {
        instanceOf: 'String',
        mapsTo: 'hello' as const,
    },
    // Supports attribute 'greetings:hello--i-am-well'
    b: '${a}--i-am-well',
    _b: {
        instanceOf: 'Boolean',
        mapsTo: 'wellBeing' as const,
    }
});

// Type inference example - TypeScript knows about these properties
type InferredType = typeof attrPatterns.__inferred;
// InferredType = { a: string, b: boolean }

// Example spawned class that uses these attributes
class MyEnhancement {
    hello: string = '';
    wellBeing: boolean = false;
    howAreYou: string = '';
    
    constructor(
        private element?: Element,
        ctx?: any,
        initVals?: any
    ) {
        if (initVals) {
            // TypeScript knows initVals has { a?: string, b?: boolean }
            Object.assign(this, initVals);
        }
    }
}

// Alternative approach: Use a more flexible Record type
type FlexibleAttrPatterns<T = any> = {
    base: string;
    _base: AttrConfig<T>;
} & {
    [K: string]: string | AttrConfig<T>;
};

// Example with explicit typing for better IDE support
interface MyAttrPatterns extends AttrPatterns<MyEnhancement> {
    base: 'greetings';
    _base: AttrPattern<MyEnhancement>;
    a: '${base}:hello';
    _a: AttrPattern<MyEnhancement>;
    b: '${a}--i-am-well';
    _b: AttrPattern<MyEnhancement>;
}

const typedPatterns: MyAttrPatterns = {
    base: 'greetings',
    _base: {
        instanceOf: 'Object',
        mapsTo: '.',
    },
    a: '${base}:hello',
    _a: {
        instanceOf: 'String',
        mapsTo: 'hello',
    },
    b: '${a}--i-am-well',
    _b: {
        instanceOf: 'Boolean',
        mapsTo: 'wellBeing',
    },
    c: '${b}---how-are-you',
    _c: {
        
    }
};


// ============================================================================
// ADVANCED APPROACH: Full Type Inference with Template Literals
// ============================================================================

/**
 * Extract variable names from template strings like '${base}:hello'
 */
type ExtractVars<S extends string> = 
    S extends `${infer _Start}\${${infer Var}}${infer Rest}`
        ? Var | ExtractVars<Rest>
        : never;

/**
 * Check if a string contains template variables
 */
type HasTemplateVars<S extends string> = 
    S extends `${string}\${${string}}${string}` ? true : false;

/**
 * Validate that all template variables reference defined properties
 */
type ValidateRefs<T, K extends keyof T> = 
    T[K] extends string
        ? HasTemplateVars<T[K]> extends true
            ? ExtractVars<T[K]> extends keyof T
                ? true
                : false
            : true
        : true;

/**
 * Type-safe AttrPatterns with validation
 */
type ValidatedAttrPatterns<T extends Record<string, any>> = {
    [K in keyof T]: K extends `_${string}` 
        ? AttrPattern<any>
        : K extends 'base'
            ? string
            : ValidateRefs<T, K> extends true
                ? string
                : never
};

/**
 * Builder with full validation
 */
function createAttrPatterns<
    const T extends ValidatedAttrPatterns<T>
>(patterns: T): T {
    return patterns;
}

// Example with validation - TypeScript will error if you reference undefined variables
const validatedPatterns = createAttrPatterns({
    base: 'greetings',
    _base: {
        instanceOf: 'Object' as const,
        mapsTo: '.' as const,
    },
    a: '${base}:hello', // ✓ Valid - 'base' exists
    _a: {
        instanceOf: 'String' as const,
        mapsTo: 'hello' as const,
    },
    b: '${a}--i-am-well', // ✓ Valid - 'a' exists
    _b: {
        instanceOf: 'Boolean' as const,
        mapsTo: 'wellBeing' as const,
    },
    // c: '${nonexistent}:test', // ✗ Would error - 'nonexistent' doesn't exist
});

// ============================================================================
// RUNTIME IMPLEMENTATION: Convert AttrPatterns to AttrPattern[]
// ============================================================================

/**
 * Resolve template variables in attribute pattern strings
 */
function resolveTemplate(template: string, patterns: Record<string, any>): string {
    return template.replace(/\$\{(\w+)\}/g, (_, varName) => {
        const value = patterns[varName];
        if (typeof value === 'string') {
            // Recursively resolve nested templates
            return resolveTemplate(value, patterns);
        }
        return varName; // Fallback if not found
    });
}

/**
 * Convert AttrPatterns object to array of AttrPattern with resolved attribute names
 */
function compileAttrPatterns<T>(patterns: AttrPatterns<T>): Array<{
    attrName: string;
    propName: string | '.';
    parser: (value: string | null) => any;
    initialOnly: boolean;
}> {
    const result: Array<{
        attrName: string;
        propName: string | '.';
        parser: (value: string | null) => any;
        initialOnly: boolean;
    }> = [];
    
    // Standard parsers
    const parsers = {
        'String': (v: string | null) => v,
        'Number': (v: string | null) => v === null ? null : Number(v),
        'Boolean': (v: string | null) => v !== null,
        'Array': (v: string | null) => {
            if (v === null) return null;
            try {
                return JSON.parse(v);
            } catch {
                return v.split(',').map(s => s.trim());
            }
        },
        'Object': (v: string | null) => {
            if (v === null) return null;
            try {
                return JSON.parse(v);
            } catch {
                return v;
            }
        }
    };
    
    // Process each user-defined property
    for (const key in patterns) {
        if (key === 'base' || key.startsWith('_')) continue;
        
        const template = patterns[key];
        const config = patterns[`_${key}`];
        
        if (typeof template === 'string' && config && typeof config === 'object') {
            const attrName = resolveTemplate(template, patterns);
            const instanceOf = config.instanceOf || 'String';
            const instanceOfStr = typeof instanceOf === 'string' 
                ? instanceOf 
                : instanceOf.name;
            
            result.push({
                attrName,
                propName: config.mapsTo === '.' ? '.' : String(config.mapsTo),
                parser: config.parser || parsers[instanceOfStr as keyof typeof parsers] || parsers.String,
                initialOnly: config.initialOnly ?? true
            });
        }
    }
    
    return result;
}

// Example usage
const compiled = compileAttrPatterns(validatedPatterns);
console.log(compiled);
// Output:
// [
//   { attrName: 'greetings:hello', propName: 'hello', parser: [Function], initialOnly: true },
//   { attrName: 'greetings:hello--i-am-well', propName: 'wellBeing', parser: [Function], initialOnly: true }
// ]

// ============================================================================
// INTEGRATION WITH IBaseRegistryItem
// ============================================================================

/**
 * Extended IBaseRegistryItem that supports AttrPatterns
 */
interface IBaseRegistryItemWithPatterns<T = any> {
    spawn: { new (oElement?: Element, ctx?: any, initVals?: Partial<T>): T };
    map: { [key: string | symbol]: keyof T };
    enhKey?: string;
    lifecycleKeys?: {
        dispose?: string;
        resolved?: string;
    };
    // NEW: Support both compiled patterns and declarative patterns
    attrPatterns?: Array<{
        attrName: string;
        propName: string | '.';
        parser: (value: string | null) => any;
        initialOnly: boolean;
    }> | AttrPatterns<T>;
}

/**
 * Helper to normalize attrPatterns to compiled form
 */
function normalizeAttrPatterns<T>(
    patterns: IBaseRegistryItemWithPatterns<T>['attrPatterns']
): Array<{
    attrName: string;
    propName: string | '.';
    parser: (value: string | null) => any;
    initialOnly: boolean;
}> {
    if (!patterns) return [];
    
    if (Array.isArray(patterns)) {
        return patterns;
    }
    
    // It's an AttrPatterns object, compile it
    return compileAttrPatterns(patterns);
}

// Example usage with IBaseRegistryItem
const registryItem: IBaseRegistryItemWithPatterns<MyEnhancement> = {
    spawn: MyEnhancement,
    map: {},
    enhKey: 'myEnhancement',
    attrPatterns: validatedPatterns // Can use declarative patterns!
};

// At runtime, normalize to compiled form
const normalizedPatterns = normalizeAttrPatterns(registryItem.attrPatterns);
