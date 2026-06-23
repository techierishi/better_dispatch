# Technical Specification: Better Dispatch Chrome Extension



**Better Dispatch** is a developer-focused productivity Chrome Extension that replaces the rigid, 5-element constraint of the native GitHub Actions `workflow_dispatch` web form with an advanced, developer-friendly interface. By parsing non-destructive, custom metadata blocks from workflow configurations, the extension builds complex UI layouts featuring code syntax highlighting editors, searchable dropdowns, multiselect lists, and dynamically fetched option payloads.

## Tech-Stach
Svelte

---

## 1. Safe YAML Configuration Strategy

To prevent GitHub from rejecting your workflow files, this architecture exploits a native feature of GitHub's YAML parser: **GitHub completely ignores custom root-level keys.** 

Instead of embedding non-standard properties inside the official `on.workflow_dispatch.inputs` schema (which causes schema validation errors), all advanced layouts are defined under a custom, standalone property at the root level of your YAML file called `x-better-dispatch`.

### Production-Ready Workflow Template
```yaml
name: Production Deployment

# 1. Official GitHub triggers remain untouched and perfectly valid
on:
  workflow_dispatch:
    inputs:
      deploy_notes:
        type: string
        description: "Release notes (Fallback text box for standard GitHub UI)"
      target_microservices:
        type: string
        description: "Comma-separated services (Fallback text box for standard GitHub UI)"
      feature_flags:
        type: string
        description: "Selected flags (Fallback text box for standard GitHub UI)"

# 2. Custom root key safely ignored by GitHub, parsed by your extension
      better_dispatch_inputs:
      type: string
      required: false
      default: |
          version: "1.0.0"
          elements:
            - id: deploy_notes
              type: textarea
              editor: prism
              language: markdown
              placeholder: "Enter markdown release logs here..."
            - id: target_microservices
              type: multiselect
              searchable: true
              # Declarative HTTP call config to fetch dynamic list options
              datasource:
                url: "https://company.com"
                method: "GET"
                headers:
                  Authorization: "Bearer \${SETTINGS_INTERNAL_TOKEN}"
                dataPath: "data.services" # JSON path selector for the array
                mapping:
                  label: "display_name"   # What the user sees in the searchable dropdown
                  value: "service_id"     # The string value sent on submission
            - id: feature_flags
              type: multiselect
              searchable: true
              options:
                - beta-dashboard
                - new-payment-gateway
                - performance-logs
```

---

## 2. Architecture & Workflow Topology

### Core Component Interaction
```
[ GitHub Actions UI ] --(Scrapes DOM/Detects x-better-dispatch)--> [ Content Script ]
                                                                        │ (Injects Button)
                                                                        ▼
[ Native API Run ] <--(Dispatches JSON via REST API)-- [ Extension Tab: Rich Form ]
                                                                        ▲
                                                                        │ (Reads Token)
                                                               [ Settings Storage ]
```

### End-to-End Operational Lifecycle
1. **Detection:** A background content script monitors repository paths (`://github.com*`).
2. **Parsing:** When the manual trigger panel is opened, the script fetches the workflow's source YAML code via the GitHub REST API and checks for the root-level `x-better-dispatch` signature.
3. **UI Mutation:** If detected, a custom action button styled as **"Better Dispatch ⚡"** is appended alongside the native "Run workflow" trigger button.
4. **Context Handoff:** Clicking the button serializes the current Repository coordinates (`owner`, `repo`, `ref`, `yaml_content`) and passes them to a newly spawned extension workspace tab.
5. **Dynamic Form Construction:** The workspace application renders custom components, triggers third-party configuration API queries, and captures user input.
6. **Execution & Translation:** Upon user submission, advanced data types are flattened (e.g., Arrays into CSV strings, text areas into sanitized block-strings) matching the standard input names, and securely transmitted back to GitHub's `actions/workflows/{workflow_id}/dispatches` endpoint.

---

## 3. UI Component Catalog

### Big Text Area with Prism Editor
* **Description:** A robust input area for complex structural code blocks, config patches, or comprehensive deployment logs.
* **Technical Stack:** Integrated with `prismjs` or `monaco-editor`.
* **Output Format:** Escaped single-line or block-formatted text string payload containing clean newline (`\n`) representations.

### Searchable & Dynamic List (Declarative YAML Engine)
* **Description:** Select elements that fill lists programmatically via remote endpoints, solving the static-only option restriction.
* **Security Layer:** URL strings can ingest client-side runtime variables using a generic placeholder interpolation block (`\${SETTINGS_SECRET_NAME}`) pointing straight to the extension storage vault.
* **Output Format:** Single selected identifier string.

### Multi-Select Component
* **Description:** Clean, searchable tag-pill field enabling operators to choose multiple options concurrently.
* **Output Format:** Custom configurations govern serialization output, supporting **comma-separated arrays** (`app1,app2,app3`) or raw **YAML/JSON serialization strings**.

---

## 4. Extension Subsystems & Layouts

### Content Script (DOM Mutator)
* **Target Scope:** Matches URLs matching `https://://github.com*`.
* **Behavior:** Observes the native overlay wrapper via a `MutationObserver`. It fetches raw file data using the GitHub REST API or parses visible inline DOM data blocks to find `x-better-dispatch`.

### Settings Workspace Vault
The dedicated settings options page handles sensitive configurations using `chrome.storage.local`:

```
┌─────────────────────────────────────────────────────────────┐
│ Better Dispatch ⚡ Configurations                             │
├─────────────────────────────────────────────────────────────┤
│ GitHub Personal Access Token (PAT):                         │
│ [ ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ] (Encrypted)    │
│ Scope Required: 'workflow' or 'actions:write'              │
│                                                             │
│ External API Secrets Vault:                                 │
│ Key: SETTINGS_INTERNAL_TOKEN                                │
│ Value: [ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... ]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Security & Isolation Matrix
* **Token Access Framework:** GitHub Personal Access Tokens are held locally via Chrome's sandboxed storage instance. They are only injected into API outbound headers communicating strictly with `://github.com`.
* **CORS Management:** Request signatures referencing internal APIs use declarative network modifications (`chrome.declarativeNetRequest`) to circumvent strict Cross-Origin constraints smoothly without weakening browser protection layers.
* **Content Security Policy (CSP):** Form processing code runs detached inside the extension tab context rather than running as directly embedded scripts on GitHub's active pages to block any potential Cross-Site Scripting (XSS) attack vectors.
