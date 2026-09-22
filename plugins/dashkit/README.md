# Dashkit by NOOA

Dashkit's MCP plugin lets coding agents discover the component catalog, retrieve stable chart contracts, generate React examples, and validate visual configuration before implementation.

The server is local and dependency-free. It communicates over stdio and exposes five tools:

- `dashkit_list_components`
- `dashkit_get_component`
- `dashkit_generate_component`
- `dashkit_get_design_rules`
- `dashkit_validate_config`

Brand surfaces default to the Dashkit white-to-slate data palette while retaining a fully editable six-color series contract.

## Use with any MCP-capable agent

Point the agent's MCP configuration at the included stdio server:

```json
{
  "mcpServers": {
    "dashkit": {
      "command": "python3",
      "args": ["/absolute/path/to/dashkit/plugins/dashkit/scripts/dashkit_mcp.py"]
    }
  }
}
```

The tools are editor-agnostic and do not depend on Codex APIs. Agents can list all 38 components, inspect the shared layout contract, generate a configured React component, or validate a configuration before writing code.

## Visual identity

The plugin uses NOOA branding with a high-contrast electric-green developer-tool accent (`#76B900`). This is an independent NVIDIA-inspired visual treatment and is not an NVIDIA product or endorsement. Rendered Dashkit components continue to use their selected accent and fully editable neutral or white-to-slate series palettes.
