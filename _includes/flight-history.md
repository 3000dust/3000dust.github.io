<!-- Embed the standalone flight history widget in /life/. -->
<style>
.flight-history-frame{display:block;width:100%;height:472px;border:1px solid #dae5ec;border-radius:10px;background:#fff}
@media(max-width:600px){.flight-history-frame{height:440px}}
</style>
<iframe class="flight-history-frame" title="Interactive flight history map" src="{{ '/assets/flight-history.html' | relative_url }}" loading="eager" scrolling="no"></iframe>
