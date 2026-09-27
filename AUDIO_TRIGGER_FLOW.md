# Audio Trigger Flow

This diagram shows how a sound detected on the Raspberry Pi becomes a visual
light alert through the Tailscale network.

```mermaid
flowchart LR
    subgraph PI["Raspberry Pi"]
        A[USB microphone] --> B[Sound Detector app]
        H[Home Assistant] --> I[Smart lights]
    end

    subgraph TAILSCALE["Tailscale network"]
        T1[Pi to server VPN]
        T2[Server to Home Assistant VPN]
    end

    subgraph SERVER["OwlHacks server"]
        C[Trigger API]
        D[(PostgreSQL)]
        C --> D
    end

    B --> T1
    T1 -->|HTTPS trigger| C
    C --> T2
    T2 -->|REST commands: alert, pulse, restore| H

    classDef source fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef system fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef action fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef decision fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef result fill:#fce7f3,stroke:#db2777,color:#831843

    class A source
    class B,H system
    class C,D action
    class I result
    class T1,T2 decision
```

The pulse is implemented by alternating Home Assistant `turn_on` and
`turn_off` commands. This does not depend on the light integration supporting
Home Assistant's optional `flash` field.
