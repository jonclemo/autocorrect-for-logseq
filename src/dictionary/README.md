# Dictionary Files

## base_safe.json

This file contains the autocorrect dictionary with over 63,000 typo corrections.

### License

This dictionary is derived from the [codespell](https://github.com/codespell-project/codespell) project and is licensed under the **Creative Commons Attribution-Share-Alike License 3.0 (CC BY-SA 3.0)**.

See [../../DICTIONARY_LICENSE.md](../../DICTIONARY_LICENSE.md) for full attribution and license details.

### Regenerating

To regenerate this dictionary:

```bash
npm run build-dict
```

This will:
1. Download the latest codespell dictionary from GitHub
2. Apply conservative filtering
3. Prefer UK English spellings
4. Generate `base_safe.json`

### Dictionary Statistics

- **Total rules**: ~63,768
- **Source**: codespell dictionary.txt
- **Filtering**: Conservative (excludes ambiguous words, short words, etc.)
- **UK English**: Protected (never corrected)

