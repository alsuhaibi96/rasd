# Demo script (about 8 minutes)

1. **Dashboard**: point out the source tags, the stage toggle (AI disabled, labelled *Proposed*) and the live **Operational Chain**. Click a node to open the **Evidence Chain**.
2. **/simulation**: Flood → F-03 scripted → Start at 4×. The red banner reads *SIMULATED SCENARIO – NOT LIVE DATA* on every page.
3. Pause at **T15**. L0 shows a Warning alert, L1 shows Elevated, and the downstream areas follow by their lag. Open the Evidence drawer on AR-04 to show its reading ids and the rules that fired.
4. Resume to **T18**. L0 goes Critical, L1 goes Severe. The ranking reorders, recommendations update (old ones *superseded*), and the plan version advances.
5. **Routes**: close E03 to get an alternative route with an exclusion reason. Close the remaining links to get *No alternative route in virtual network*.
6. **What-if 30 min / rain persists**: hatched ghost overlays appear. The L0 and L1 panels stay unchanged.
7. **/plans**: show the version diff (added / withdrawn "no longer suitable" / changed, each with a reason). Approve an item, then try approving a stale version to get a conflict.
8. **Review scrubber**: drag back to T09 and forward again. The replay is deterministic.
9. **/verification**: Run all tests. 39 pass, offline tests are *Not tested* until recorded, and the verdict is honest. Print the evidence.
10. **/system**: the computed capability matrix and feature inventory. Toggle **EN**.
