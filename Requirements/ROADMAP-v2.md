# Roadmap v2: Unified Architecture with `with*` Terminology

## Status: Updated based on assign-gingerly implementation

This roadmap reflects the completed work on assign-gingerly's `withAttrs` feature and outlines the remaining steps to achieve full integration with mount-observer using consistent `with*` terminology.

## What We've Accomplished

### ✅ Phase 1: assign-gingerly Foundation (COMPLETE)

**Implemented:**
- `withAttrs` with declarative `AttrPatterns<T>` interface
- Template variable resolution (`${base}`, `${hello}`)
- Type-safe attribute pattern definitions with full TypeScript inference
- `parseWithAttrs()` utility for attribute parsing
- Integration into `ElementEnhancementContainer.get()` for initial attribute reading
- Default parsers for Object, Array, Number, Boolean, String
- Error handling for parse failures
- Comprehensive demo at `assign-gingerly/demos/withAttrs-demo.html`

**Key Design Decisions:**
- Used `withAttrs` (not `whereAttrs`) for consistency
- Declarative pattern syntax with template interpolation
- JSON-serializable configuration (string-based `instanceOf`)
- Synchronous processing
- Attribute values merged with existing `initVals` (existing takes precedence)

## Remaining Work

### Phase 2: mount-observer Terminology Update

**Goal**: Rename all `where*` properties to `with*` for consistency

#### Requirement 2.1: Update MountInit Interface
**Effort**: 2-3 hours

Rename properties in `MountInit`:
```typescript
export interface MountInit {
  // OLD → NEW
  whereElementMatches → withElementMatches
  whereAttr → withAttrs  
  whereInstanceOf → withInstanceOf
  whereMediaMatches → withMediaMatches
  whereOutside → withOutside
  
  // Keep as-is
  import?: string | ImportSpec | Array<string | ImportSpec>;
  do?: string | DoCallback | (string | DoCallback)[];
  spawn?: { new (oElement?: Element, ctx?: SpawnContext, initVals?: any): any };
  enhKey?: string;
  lifecycleKeys?: { dispose?: string; resolved?: string };
  loadingEagerness?: 'eager' | 'lazy';
  assignOnMount?: Record<string, any>;
  assignOnDismount?: Record<string, any>;
  map?: MapConfig;
  // ... rest
}
```

**Files to update:**
- `mount-observer/types.d.ts` (or equivalent)
- All references in mount-observer codebase
- Documentation and examples

#### Requirement 2.2: Update Type Names
**Effort**: 1-2 hours

Rename related types:
- `WhereAttr` → `WithAttrs` (or reuse assign-gingerly's `AttrPatterns`)
- Update all imports and references

### Phase 3: Bridge mount-observer to assign-gingerly

#### Requirement 3.1: Convert mount-observer's WithAttrs to AttrPatterns
**Effort**: 6-8 hours

**Goal**: Create utility to convert mount-observer's attribute configuration to assign-gingerly's `AttrPatterns` format.

**Current mount-observer approach:**
```typescript
{
  withAttrs: {
    hasBuiltInRootIn: ['data'],
    hasBase: 'count',
    hasBranchIn: []
  },
  map: {
    '0': { mapsTo: 'count', instanceOf: 'Number' }
  }
}
```

**Target assign-gingerly format:**
```typescript
{
  withAttrs: {
    base: 'data',
    count: '${base}-count',
    _count: {
      instanceOf: 'Number',
      mapsTo: 'count'
    }
  }
}
```

**Implementation:**
```typescript
/**
 * Converts mount-observer's withAttrs + map to assign-gingerly's AttrPatterns
 */
export function convertToAttrPatterns(
  withAttrs: WithAttrs | undefined,
  map: MapConfig | undefined,
  isCustomElement: boolean
): AttrPatterns | undefined {
  if (!withAttrs || !map) return undefined;
  
  // Use existing buildAttrCoordinateMap
  const attrCoordMap = buildAttrCoordinateMap(withAttrs, isCustomElement);
  
  // Determine base prefix
  const rootPrefixes = isCustomElement 
    ? (withAttrs.hasCERootIn || [])
    : (withAttrs.hasBuiltInRootIn || []);
  const basePrefix = rootPrefixes[0] || '';
  
  const patterns: any = {
    base: basePrefix
  };
  
  // Convert each coordinate to pattern
  for (const [attrName, coordinate] of Object.entries(attrCoordMap)) {
    const mapEntry = map[coordinate];
    if (!mapEntry?.mapsTo) continue;
    
    // Generate key from mapsTo
    const key = String(mapEntry.mapsTo);
    
    // Add template string
    patterns[key] = attrName;
    
    // Add config
    patterns[`_${key}`] = {
      instanceOf: mapEntry.instanceOf || 'String',
      mapsTo: mapEntry.mapsTo,
      parser: mapEntry.parser
    };
  }
  
  return patterns;
}
```

#### Requirement 3.2: Update Attribute Observation
**Effort**: 4-6 hours

**Goal**: Ensure mount-observer's `MutationObserver` doesn't duplicate initial attribute reading.

**Strategy:**
1. Track which attributes were read initially by assign-gingerly
2. Skip those in the first `checkAttrChanges()` call
3. Only observe subsequent changes

```typescript
// Add metadata to track initial read
const elementInitialAttrs = new WeakMap<Element, Set<string>>();

function handleMount(element: Element, mountInit: MountInit) {
  if (mountInit.spawn && mountInit.withAttrs) {
    // Spawn via assign-gingerly (reads initial attributes)
    const registryItem = mountInitToRegistryItem(mountInit, isCustomElement);
    const instance = element.enh.get(registryItem);
    
    // Track which attributes were read
    const attrNames = Object.keys(buildAttrCoordinateMap(mountInit.withAttrs, isCustomElement));
    elementInitialAttrs.set(element, new Set(attrNames));
    
    // Set up observation for future changes
    observeAttributeChanges(element, mountInit, /* skipInitial */ true);
  }
}
```

### Phase 4: Extend MountInit with spawn Support

#### Requirement 4.1: Add spawn to MountInit
**Effort**: 4-6 hours

**Goal**: Make `MountInit` support `spawn` from `IBaseRegistryItem`.

Already outlined in original Requirement 5, but update to use `with*` terminology.

```typescript
function mountInitToRegistryItem(
  mountInit: MountInit,
  isCustomElement: boolean
): IBaseRegistryItem | null {
  if (!mountInit.spawn) return null;
  
  return {
    spawn: mountInit.spawn,
    map: {}, // Symbol-based DI map if needed
    enhKey: mountInit.enhKey,
    lifecycleKeys: mountInit.lifecycleKeys,
    withAttrs: convertToAttrPatterns(
      mountInit.withAttrs,  // Updated from whereAttr
      mountInit.map,
      isCustomElement
    )
  };
}
```

#### Requirement 4.2: Formalize Type Relationship
**Effort**: 3-4 hours

**Goal**: Make `MountInit` extend `IBaseRegistryItem` (or at least be compatible).

**Challenge**: The `map` property conflict
- `IBaseRegistryItem.map`: Symbol-based dependency injection
- `MountInit.map`: Attribute coordinate to property mapping

**Solution**: Rename in MountInit
```typescript
export interface MountInit extends Partial<IBaseRegistryItem> {
  withElementMatches: string;
  withAttrs?: WithAttrs;  // Different from IBaseRegistryItem.withAttrs
  withInstanceOf?: Constructor | Constructor[];
  withMediaMatches?: string | MediaQueryList;
  withOutside?: string;
  
  // Rename to avoid conflict
  attrMap?: MapConfig;  // Was: map
  
  // From IBaseRegistryItem
  spawn?: { new (oElement?: Element, ctx?: SpawnContext, initVals?: any): any };
  enhKey?: string;
  lifecycleKeys?: { dispose?: string; resolved?: string };
  map?: { [key: symbol]: string };  // DI map from IBaseRegistryItem
  
  // mount-observer specific
  do?: string | DoCallback | (string | DoCallback)[];
  import?: string | ImportSpec | Array<string | ImportSpec>;
  loadingEagerness?: 'eager' | 'lazy';
  assignOnMount?: Record<string, any>;
  assignOnDismount?: Record<string, any>;
  // ... rest
}
```

### Phase 5: Documentation and Examples

#### Requirement 5.1: Update All Documentation
**Effort**: 8-12 hours

- Update all examples to use `with*` terminology
- Create migration guide from `where*` to `with*`
- Document the unified architecture
- Show examples of:
  - Pure assign-gingerly usage
  - Pure mount-observer usage  
  - Hybrid usage (spawn + observation)
  - Migration from callbacks to classes

#### Requirement 5.2: Create Integration Examples
**Effort**: 6-8 hours

Examples to create:
1. **Counter with spawn**: Button with `withAttrs` reading initial count
2. **Form enhancement**: Multiple inputs with attribute mapping
3. **Hybrid approach**: Initial spawn + ongoing observation
4. **Migration example**: Before/after showing `do` → `spawn`

### Phase 6: Testing and Hardening

#### Requirement 6.1: Integration Tests
**Effort**: 8-10 hours

- Test assign-gingerly standalone
- Test mount-observer with spawn
- Test attribute reading precedence
- Test lifecycle methods
- Test error cases

#### Requirement 6.2: Performance Testing
**Effort**: 4-6 hours

- Benchmark attribute parsing
- Compare to previous implementation
- Ensure no regressions

## Total Remaining Effort

- **Phase 2**: 3-5 hours (terminology update)
- **Phase 3**: 10-14 hours (bridge layer)
- **Phase 4**: 7-10 hours (spawn support)
- **Phase 5**: 14-20 hours (documentation)
- **Phase 6**: 12-16 hours (testing)

**Total**: 46-65 hours (~1-1.5 weeks full-time)

## Migration Path for Users

### Breaking Changes
- All `where*` properties renamed to `with*`
- `MountInit.map` renamed to `MountInit.attrMap`

### Migration Script
Provide a codemod or find/replace guide:
```typescript
// Find: whereElementMatches
// Replace: withElementMatches

// Find: whereAttr
// Replace: withAttrs

// Find: whereInstanceOf
// Replace: withInstanceOf

// etc.
```

### Deprecation Strategy
1. **v1.x**: Support both `where*` and `with*` (with deprecation warnings)
2. **v2.0**: Remove `where*` support

## Success Criteria

1. ✅ assign-gingerly can read initial attributes (DONE)
2. ⬜ Consistent `with*` terminology across both packages
3. ⬜ mount-observer can use assign-gingerly's spawn
4. ⬜ No duplicate attribute reading
5. ⬜ Full type safety and inference
6. ⬜ Comprehensive documentation
7. ⬜ All tests passing
8. ⬜ Performance maintained or improved

## Next Steps

1. Review this roadmap
2. Decide on deprecation strategy (support both vs clean break)
3. Start with Phase 2 (terminology update)
4. Implement Phase 3 (bridge layer)
5. Continue through remaining phases

---

**Note**: This is a living document. Update as implementation progresses.
