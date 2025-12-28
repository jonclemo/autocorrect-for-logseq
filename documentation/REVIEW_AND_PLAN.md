# ChatGPT Suggestions Review & Implementation Plan

## Review of Suggestions

### 🔴 **Critical - Must Fix (High Impact, Low Risk)**

#### 1. **Fix #3: Don't rebuild rules on-demand** ⭐⭐⭐⭐⭐
**Value**: **CRITICAL** - This is the biggest performance issue
- Currently rebuilding 63,769-key object on every correction attempt
- Causes CPU/GC spikes
- Easy to fix, zero risk

**Current Code Issue**:
```typescript
const currentRules = buildRules(currentRemote, currentBase); // Called every poll!
```

**Impact**: 10-100x performance improvement expected

---

### 🟡 **High Value - Should Fix (High Impact, Medium Risk)**

#### 2. **Fix #1: Stop doing 4-5 API calls every 300ms** ⭐⭐⭐⭐
**Value**: **HIGH** - Reduces overhead significantly
- Adaptive polling (idle 2s, active 200ms)
- Only poll when editing
- Reduces API calls by 5-20x

**Risk**: Low - just changing polling intervals

#### 3. **Fix #2: Only call getCursorPos() when needed** ⭐⭐⭐⭐
**Value**: **HIGH** - Cursor position is slowest API call
- Current: Calls cursor API even when content unchanged
- Better: Only call when content changed AND boundary detected

**Risk**: Low - just reordering checks

#### 4. **Fix #3 (Adaptive Polling): Stop polling when not editing** ⭐⭐⭐⭐
**Value**: **HIGH** - Eliminates unnecessary work
- Currently polls forever even when idle
- Should stop/slow when not editing

**Risk**: Low - straightforward logic change

---

### 🟢 **Medium Value - Consider (Medium Impact, Variable Risk)**

#### 5. **Fix #4: Replace suppressNext with suppressCount** ⭐⭐⭐
**Value**: **MEDIUM** - Prevents race conditions
- Current boolean can mis-fire with async operations
- Counter is more robust

**Risk**: Low - simple change

#### 6. **Fix #5: Don't fetch current block every time** ⭐⭐⭐
**Value**: **MEDIUM** - Reduces API calls
- Cache block UUID, only refetch when needed
- Track lastBlockUuid more efficiently

**Risk**: Low - caching improvement

#### 7. **Fix #6: DOM input listener approach** ⭐⭐⭐
**Value**: **HIGH** - Eliminates polling during typing
**Risk**: **MEDIUM-HIGH** - Requires DOM manipulation
- Logseq's DOM structure may change
- Need to find correct selector
- May break with Logseq updates
- Best as future enhancement, not immediate fix

**Recommendation**: Defer to Phase 2, test thoroughly

#### 8. **Small logic issue: Check cursor-adjacent char, not last char** ⭐⭐⭐
**Value**: **MEDIUM** - Fixes mid-text editing edge case
- Current: `content.slice(-1)` assumes cursor at end
- Better: Check character at `cursorPos - 1`

**Risk**: Low - logic fix

---

### 🔵 **Low Priority - Nice to Have (Low Impact)**

#### 9. **Micro-optimizations** ⭐⭐
**Value**: **LOW-MEDIUM** - Minor improvements
- Use Map instead of object (minimal gain for our use case)
- Early exits (already mostly done)
- Lowercase once (already done)

**Risk**: Low but impact is minimal

#### 10. **Deferred autocorrect (microtask)** ⭐⭐
**Value**: **LOW** - May reduce cursor jank slightly
- Current approach works fine
- May add unnecessary complexity

**Risk**: Low but questionable benefit

---

## Implementation Plan

### **Phase 1: Critical Performance Fixes** (Immediate - 1-2 hours)

**Goal**: Fix the biggest performance issues with minimal risk

1. **Fix #3: Cache rules, rebuild only on change** ⭐⭐⭐⭐⭐
   - Create `rules` cache variable
   - Add `rebuildRules()` function
   - Call only when: base loads, remote updates, settings change
   - Remove `buildRules()` calls from polling/handlers
   - **Expected Impact**: 10-100x performance improvement

2. **Fix #2: Optimize API call order** ⭐⭐⭐⭐
   - Reorder checks: content → boundary → cursor
   - Only call `getCursorPos()` when actually needed
   - **Expected Impact**: 2-5x reduction in API calls

3. **Fix #4: Replace suppressNext with suppressCount** ⭐⭐⭐
   - Change boolean to counter
   - More robust against race conditions
   - **Expected Impact**: Better reliability

**Estimated Time**: 1-2 hours
**Risk**: Very Low
**Impact**: Very High

---

### **Phase 2: Adaptive Polling** (Next - 1 hour)

**Goal**: Reduce polling overhead when not editing

4. **Fix #1 & #3: Adaptive polling with backoff** ⭐⭐⭐⭐
   - Implement 2-tier polling (idle 2s, active 200ms)
   - Use `setTimeout` chain instead of `setInterval`
   - Stop/slow when not editing
   - **Expected Impact**: 5-20x reduction in idle overhead

5. **Fix #5: Cache block UUID** ⭐⭐⭐
   - Only refetch block when UUID changes
   - Reduce `getCurrentBlock()` calls
   - **Expected Impact**: 2-3x reduction in API calls

**Estimated Time**: 1 hour
**Risk**: Low
**Impact**: High

---

### **Phase 3: Logic Improvements** (Optional - 30 mins)

**Goal**: Fix edge cases and improve correctness

6. **Fix cursor-adjacent character check** ⭐⭐⭐
   - Check character at `cursorPos - 1` instead of `content.slice(-1)`
   - Fixes mid-text editing edge case
   - **Expected Impact**: Better correctness

**Estimated Time**: 30 minutes
**Risk**: Very Low
**Impact**: Medium

---

### **Phase 4: Advanced (Future Consideration)** (Defer)

**Goal**: Explore DOM listener approach (requires testing)

7. **Fix #6: DOM input listener** ⭐⭐⭐
   - **Defer for now** - requires:
     - Finding correct Logseq editor selector
     - Testing across Logseq versions
     - Handling DOM remounts
     - Fallback to polling
   - **Risk**: Medium-High (may break with Logseq updates)
   - **Impact**: High (eliminates polling during typing)
   - **Recommendation**: Research Logseq community examples first

**Estimated Time**: 2-4 hours (including testing)
**Risk**: Medium-High
**Impact**: High (if it works)

---

## Recommended Implementation Order

### **Immediate (Do Now)**
1. ✅ Fix #3: Cache rules (CRITICAL - biggest win)
2. ✅ Fix #2: Optimize API call order
3. ✅ Fix #4: suppressCount

### **Next Session**
4. ✅ Fix #1 & #3: Adaptive polling
5. ✅ Fix #5: Cache block UUID

### **Optional**
6. ✅ Fix cursor-adjacent character check

### **Future Research**
7. ⏸️ DOM listener approach (research first)

---

## Expected Overall Impact

**After Phase 1**:
- 10-100x performance improvement (rules caching)
- 2-5x reduction in API calls
- Better reliability (suppressCount)

**After Phase 2**:
- 5-20x reduction in idle overhead
- 2-3x further reduction in API calls
- More responsive when editing

**Combined**:
- **50-200x overall performance improvement**
- **10-25x reduction in API calls**
- **Much lighter on CPU/GC**

---

## Risk Assessment

| Fix | Risk | Impact | Priority |
|-----|------|--------|----------|
| Cache rules | Very Low | Very High | 🔴 Critical |
| Optimize API calls | Low | High | 🟡 High |
| Adaptive polling | Low | High | 🟡 High |
| suppressCount | Low | Medium | 🟡 High |
| Cache block UUID | Low | Medium | 🟢 Medium |
| Cursor-adjacent check | Very Low | Medium | 🟢 Medium |
| DOM listeners | Medium-High | High | 🔵 Future |

---

## Notes

1. **Rules caching is the #1 priority** - This alone will make the biggest difference
2. **Adaptive polling is #2** - Easy win with low risk
3. **DOM listeners are interesting but risky** - Research Logseq community examples first
4. **All Phase 1 fixes are low-risk, high-reward** - Safe to implement immediately

