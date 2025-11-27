# Extraction Test Artifacts

**Note: These are ephemeral development artifacts for sharing test results between developers. They should be deleted before merging to main.**

## Contents

### Reports
- `comparison-report.html` - Visual HTML report comparing extraction results across models
- `comparison.json` - Raw comparison data in JSON format
- `cross-model-analysis.json` - Cross-model analysis with metrics and insights

### Directories
- `cache/` - Cached API responses (MD5-hashed) to avoid redundant API calls during testing
- `runs/` - Individual test run results with timestamps

## Purpose

These artifacts allow developers to:
1. View extraction results without re-running expensive API calls
2. Compare model performance (Gemini 2.5 Pro, Claude Sonnet 4.5, GPT-4o)
3. Debug extraction issues using cached responses

## Cleanup

Before merging to main, remove these artifacts:
```bash
rm -rf tests/comparison-results/cache/
rm -rf tests/comparison-results/runs/
rm tests/comparison-results/*.json
rm tests/comparison-results/*.html
```

Or simply delete the entire directory if no longer needed.
