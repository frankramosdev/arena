# Creation Agent - Source Code

```
src/
├── index.ts           # Main exports
├── cli.ts             # Command-line interface
│
├── agent/             # Core agent logic
│   └── index.ts       # CreationAgent class (single agentic call)
│
├── config/            # Configuration
│   └── index.ts       # Environment config, validation
│
├── prompts/           # LLM prompts
│   ├── index.ts       # Exports
│   ├── system.ts      # System prompt (role, constraints)
│   └── market.ts      # Market generation prompt (task, schema)
│
├── types/             # Type definitions
│   ├── index.ts       # Exports
│   ├── market.ts      # Market schemas
│   ├── verification.ts # Verification schemas
│   └── config.ts      # Config types
│
└── utils/             # Shared utilities
    ├── index.ts       # Exports
    ├── id.ts          # ID generation
    ├── date.ts        # Date utilities
    └── log.ts         # Logging
```

## Architecture

Single agentic call using `xai.responses()` with `xai.tools.xSearch()`.
Model decides when/what to search. Outputs JSON validated against schema.

## Prompts

- **system.ts** - Agent role, constraints, forbidden markets, time context
- **market.ts** - Task instructions, search strategy, JSON schema, examples

## Quick Reference

### Modify prompts
- `prompts/system.ts` - Change agent behavior/constraints
- `prompts/market.ts` - Change task instructions/output format

### Add market type
1. Add to `types/verification.ts` 
2. Update `prompts/system.ts` and `prompts/market.ts`

### Configuration
- Add env vars to `config/index.ts`
