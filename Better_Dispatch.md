# Technical Specification: Better Dispatch Chrome Extension

**Better Dispatch** is a developer-focused productivity Chrome Extension that replaces the rigid, 5-element constraint of the native GitHub Actions `workflow_dispatch` web form with an advanced, developer-friendly interface. Forms are defined via SurveyJS JSON files in your repository and rendered using SurveyJS's rich component library.

## Tech-Stack
Svelte, SurveyJS

---

## 1. Safe Configuration Strategy

To prevent GitHub from rejecting your workflow files, this architecture exploits a native feature of GitHub's YAML parser: **GitHub ignores custom properties it doesn't understand.**

All advanced form layouts are defined in a standalone SurveyJS JSON file (e.g., `.github/better_dispatch/sample_form.json`) and referenced by the `better_dispatch_form` input's `default` value.

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

# 2. Custom input safely ignored by GitHub, parsed by your extension
      better_dispatch_form:
        type: string
        required: false
        default: .github/better_dispatch/sample_form.json
```

### SurveyJS Form Definition (`sample_form.json`)
```json
{
  "showQuestionNumbers": false,
  "completeText": "Dispatch Workflow ⚡",
  "pages": [{
    "elements": [
      {
        "type": "comment",
        "name": "deploy_notes_custom",
        "title": "Deploy Notes",
        "placeholder": "Enter markdown release logs here...",
        "rows": 6
      },
      {
        "type": "tagbox",
        "name": "target_microservices_custom",
        "title": "Target Microservices",
        "choicesByUrl": {
          "url": "https://company.com",
          "path": "data.services",
          "valueName": "service_id",
          "titleName": "display_name"
        },
        "fetchConfig": {
          "method": "GET",
          "headers": {
            "Authorization": "Bearer ${SETTINGS_INTERNAL_TOKEN}"
          }
        }
      },
      {
        "type": "tagbox",
        "name": "feature_flags_custom",
        "title": "Feature Flags",
        "choices": [
          "beta-dashboard",
          "new-payment-gateway",
          "performance-logs"
        ]
      }
    ]
  }]
}
```

---

## 2. Architecture & Workflow Topology

### Core Component Interaction
```
[ GitHub Actions UI ] --(Scrapes DOM/Detects workflow file)--> [ Content Script ]
                                                                    │ (Injects Button)
                                                                    ▼
[ Native API Run ] <--(Dispatches JSON via REST API)-- [ Extension Tab: SurveyJS Form ]
                                                                    ▲
                                                                    │ (Reads Token)
                                                           [ Settings Storage ]
```

### End-to-End Operational Lifecycle
1. **Detection:** A background content script monitors repository paths (`github.com*`).
2. **Parsing:** When the manual trigger panel is opened, the script fetches the workflow YAML via the GitHub REST API, reads the `better_dispatch_form` input's default value to locate the form definition file, then fetches that file.
3. **UI Mutation:** If detected, a custom action button styled as **"Better Dispatch ⚡"** is appended alongside the native "Run workflow" trigger button.
4. **Context Handoff:** Clicking the button passes repository coordinates (`owner`, `repo`, `ref`) to a new extension workspace tab.
5. **Dynamic Form Construction:** The workspace creates a SurveyJS model from the JSON, pre-fetches any datasources via the extension's background script (bypassing CORS), and renders the form.
6. **Submission:** SurveyJS validates the input, then the extension maps question values to GitHub inputs (standard names go directly, custom names are packed into `better_dispatch_form` as JSON) and dispatches via the GitHub API.

---

## 3. SurveyJS Component Mapping

Better Dispatch uses SurveyJS element types mapped to GitHub Actions form needs:

| SurveyJS Type | GitHub Use | Description |
|--------------|------------|-------------|
| `comment` | Textarea | Multi-line text input for notes, configs, logs |
| `tagbox` | Multi-Select | Searchable tag-pill selector with dynamic or static choices |
| `dropdown` | Single-Select | Searchable dropdown (via `searchEnabled: true`) |
| `text` | Text Input | Single-line text input |
| `boolean` | Checkbox | True/false toggle |

### Dynamic Choices via `choicesByUrl`
SurveyJS's `choicesByUrl` defines the URL, JSON path, and label/value mapping. The extension intercepts these fetches via the background script to handle custom headers and CORS. Additional fetch configuration (method, headers) is placed in a custom `fetchConfig` property on the question.

---

## 4. Extension Subsystems & Layouts

### Content Script (DOM Mutator)
* **Target Scope:** Matches URLs matching `github.com*`.
* **Behavior:** Observes the native overlay wrapper via a `MutationObserver`. It fetches raw file data using the GitHub REST API to find the workflow file.

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
* **Token Access Framework:** GitHub Personal Access Tokens are held locally via Chrome's sandboxed storage instance. They are only injected into API outbound headers communicating strictly with `github.com`.
* **CORS Management:** Datasource requests are proxied through the extension's background script, bypassing cross-origin restrictions without weakening browser security layers.
* **Content Security Policy (CSP):** Form processing code runs detached inside the extension tab context rather than as directly embedded scripts on GitHub's active pages.
