# Known issues and limitations

- **Offline (TC-11a/b, AT-24): Verification Pending.** The core is local (self-hosted fonts, local GeoJSON, no external APIs), but nothing is claimed until a recorded run exists.
- **AI: Not Configured.** It is shown disabled and labelled Proposed. No model, no training data.
- **Virtual geography.** The basin, the areas AR-01…AR-08 and the road network are illustrative. They are not real places or roads.
- **Parameters** (L1, AREA, RANK, WHATIF) are illustrative scenario values and have not been validated hydrologically.
- **External devices**: ESP32 readings are tagged `external` until they are operationally verified. No source is tagged `real` yet.
- **Single process**: `emitLocal` assumes one Node process (see architecture.md).
- **Interrupted runs**: a server restart during a run marks it `interrupted`. It is not resumed automatically. Start a new run.
- **Earthquake and dust scenarios** are shown as unavailable (not approved).
