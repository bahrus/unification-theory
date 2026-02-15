# Requirement 1: Add Declarative Attribute Patterns to EnhancementConfig

## Goal
Extend `EnhancementConfig` in assign-gingerly to support declarative attribute mapping with TypeScript type safety, template interpolation, and JSON serialization support.

## Background
Currently, mount-observer's `MountInit` interface has `whereAttr?: WhereAttr` and `map?: MapConfig` for declarative attribute observation and mapping. We need to add similar capability to assign-gingerly's `IBaseRegistryItem`, but with:
- Full TypeScript type inference
- Template variable support for DRY attribute naming
- JSON serialization compatibility
- Support for both declarative and compiled formats

## Proposed Changes

### Core Interfaces

```typescript
export interface AttrConfig<T = any> {
  /**
   * Type of the property value (JSON-serializable string format)
   */
  instanceOf?: 'Object' | 'String' | 'Number' | 'Boolean' | 'Array' 
              | typeof Object | typeof String | typeof Number | typeof Boolean | typeof Array;
  
  /**
   * Property name on the spawned class instance to map to
   * Use '.' to map to the root object
   */
  mapsTo: '.' | keyof T | `?.${pathString}` | `!delete ${pathString}`;
  
  /**
   * Optional parser function to transform attribute string value
   */
  parser?: (attrValue: string | null) => any;
  
  /**
   * Whether to only read the initial value (true) or continue observing changes (false)
   * Defaults to true (initial read only)
   */
  initialOnly?: boolean;
}

export interface AttrPatterns<T = any> {
  /**
   * Base prefix for attribute names
   */
  base: string;
  
  /**
   * Configuration for the base pattern
   */
  _base: AttrConfig<T>;
  
  /**
   * User-defined patterns:
   * - Keys without underscore: template strings (e.g., '${base}:hello')
   * - Keys with underscore: configuration objects (e.g., _a: { instanceOf: 'String', mapsTo: 'hello' })
   */
  [key: string]: string | AttrConfig<T>;
}
```

### Extend EnhancementConfig

```typescript
export interface EnhancementConfig<T = any> {
  spawn: { new (oElement?: Element, ctx?: any, initVals?: Partial<T>): T };
  map: { [key: string | symbol]: keyof T };
  enhKey?: string;
  lifecycleKeys?: {
    dispose?: string;
    resolved?: string;
  };
  /**
   * Attribute patterns - supports both formats:
   * 1. Compiled array format (for runtime efficiency)
   * 2. Declarative AttrPatterns format (for type safety and DRY)
   */
  attrPatterns?: Array<{
    attrName: string;
    propName: string | '.';
    parser: (value: string | null) => any;
    initialOnly: boolean;
  }> | AttrPatterns<T>;
}
```

## Declarative Usage Example

```typescript
class GreetingEnhancement {
  hello: string = '';
  wellBeing: boolean = false;
}

const patterns = createAttrPatterns({
  base: 'greetings',
  _base: { instanceOf: 'Object', mapsTo: '.' },
  a: '${base}:hello',           // Resolves to 'greetings:hello'
  _a: { instanceOf: 'String', mapsTo: 'hello' },
  b: '${a}--i-am-well',         // Resolves to 'greetings:hello--i-am-well'
  _b: { instanceOf: 'Boolean', mapsTo: 'wellBeing' }
});

const registryItem: EnhancementConfig<GreetingEnhancement> = {
  spawn: GreetingEnhancement,
  map: {},
  enhKey: 'greeting',
  attrPatterns: patterns  // TypeScript validates property names and types!
};
```

## Implementation Requirements

### 1. Template Resolution
Implement recursive template variable resolution:

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

### 2. Pattern Compilation
Convert declarative format to array format:

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

### 3. Format Normalization
Support both formats transparently:

```typescript
function normalizeAttrPatterns<T>(
  patterns: EnhancementConfig<T>['attrPatterns']
): Array<{...}> {
  if (!patterns) return [];
  if (Array.isArray(patterns)) return patterns;
  return compileAttrPatterns(patterns); // Compile declarative to array
}
```

### 4. Type-Safe Builder
Provide helper for type-safe pattern creation:

```typescript
function createAttrPatterns<const T extends ValidatedAttrPatterns<T>>(
  patterns: T
): T {
  return patterns;
}
```

## Benefits

1. **Type Safety**: TypeScript validates template variable references and property names at compile time
2. **DRY Patterns**: Template interpolation eliminates repetitive attribute name prefixes
3. **JSON Serializable**: String-based `instanceOf` allows patterns to be stored in JSON
4. **Backward Compatible**: Existing array format continues to work
5. **IDE Support**: Full autocomplete and type checking in IDEs

## Rationale

- `attrPatterns` is neutral terminology that works for both programmatic and declarative scenarios
- Template variables (`${base}`, `${a}`) enable DRY attribute naming hierarchies
- Supporting both formats allows gradual migration and runtime optimization
- String-based `instanceOf` enables JSON serialization for configuration files
- Type inference ensures `initVals` matches the spawned class properties

## Next Steps

1. Implement `resolveTemplate()`, `compileAttrPatterns()`, and `normalizeAttrPatterns()` utilities
2. Update spawn logic to read initial attribute values using normalized patterns
3. Add runtime validation for template variable references
4. Create comprehensive tests for nested templates and type inference

## Answered Questions

1. **Nested property paths**: Use `mapsTo: '.'` to map to root object, then handle nesting in the spawned class
2. **Built-in parsers**: Yes, via `getParser(instanceOf)` that maps 'String', 'Number', 'Boolean', etc. to appropriate parsers
3. **Attribute prefixes**: Yes, via `base` property and template interpolation

## Reference

See `Requirements/AttrPatterns-TypeScript-Modeling.md` for complete specification including:
- Type inference implementation
- Template variable validation
- Migration guide from array format
- Advanced usage examples
- Future enhancement roadmap
