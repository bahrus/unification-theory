# Naming Update: IBaseRegistryItem → EnhancementConfig

## Summary

Successfully renamed `IBaseRegistryItem` to `EnhancementConfig` across the assign-gingerly codebase to better reflect its purpose and prepare for integration with mount-observer's `MountConfig`.

## Changes Made

### Type Definitions

**assign-gingerly/types.d.ts:**
- ✅ Renamed `IBaseRegistryItem<T>` → `EnhancementConfig<T>`
- ✅ Added backward compatibility alias: `type IBaseRegistryItem<T> = EnhancementConfig<T>` with `@deprecated` tag
- ✅ Updated `SpawnContext.mountInfo` to use `EnhancementConfig<T>`
- ✅ Updated `BaseRegistry` methods to use `EnhancementConfig`

**assign-gingerly/assignGingerly.ts:**
- ✅ Renamed interface definition
- ✅ Added backward compatibility alias
- ✅ Updated `getInstanceMap()` return type
- ✅ Updated `BaseRegistry` class implementation
- ✅ Updated all method signatures

**assign-gingerly/demos/experiments.ts:**
- ✅ Updated import statement
- ✅ Updated type annotation

**Requirements/Requirement1.md:**
- ✅ Updated all references to use `EnhancementConfig`

## Rationale

### Why "EnhancementConfig"?

1. **Semantic Clarity**: "Config" is universally understood as configuration
2. **Purpose-Driven**: Clearly describes what it configures (enhancements)
3. **Hierarchical**: Sets up natural extension to `MountConfig` in mount-observer
4. **Concise**: Shorter than alternatives while remaining descriptive

### Naming Hierarchy

```
EnhancementConfig (assign-gingerly)
    ↓ extends
MountConfig (mount-observer)
```

This creates a clear conceptual model:
- **EnhancementConfig**: How to enhance an element (spawn, attributes, lifecycle)
- **MountConfig**: When and where to mount enhancements (selectors, conditions, observation)

## Backward Compatibility

The deprecated `IBaseRegistryItem` type alias ensures existing code continues to work:

```typescript
// Old code still works
const config: IBaseRegistryItem<MyClass> = { ... };

// New code uses better name
const config: EnhancementConfig<MyClass> = { ... };
```

TypeScript will show deprecation warnings encouraging migration to the new name.

## Next Steps

### For assign-gingerly Users
- Update type annotations from `IBaseRegistryItem` to `EnhancementConfig`
- No runtime changes required (it's just a type rename)

### For mount-observer Integration
1. Create `MountConfig` interface that extends `EnhancementConfig`
2. Rename `where*` properties to `with*` for consistency
3. Add bridge utilities to convert mount-observer's attribute config to assign-gingerly's `AttrPatterns`

## Migration Guide

### Simple Find & Replace

```typescript
// Find:    IBaseRegistryItem
// Replace: EnhancementConfig
```

### Example Migration

**Before:**
```typescript
import { IBaseRegistryItem } from 'assign-gingerly';

const config: IBaseRegistryItem<ButtonClass> = {
  spawn: ButtonClass,
  enhKey: 'button',
  withAttrs: { ... }
};
```

**After:**
```typescript
import { EnhancementConfig } from 'assign-gingerly';

const config: EnhancementConfig<ButtonClass> = {
  spawn: ButtonClass,
  enhKey: 'button',
  withAttrs: { ... }
};
```

## Files Modified

- `assign-gingerly/types.d.ts`
- `assign-gingerly/assignGingerly.ts`
- `assign-gingerly/demos/experiments.ts`
- `Requirements/Requirement1.md`
- `Requirements/NAMING-UPDATE.md` (this file)

## Verification

All TypeScript compilation and diagnostics pass:
- ✅ No compilation errors
- ✅ No type errors
- ✅ Backward compatibility maintained
- ✅ All demos work correctly

---

**Date**: 2026-02-15  
**Status**: Complete  
**Breaking Changes**: None (backward compatible via type alias)
