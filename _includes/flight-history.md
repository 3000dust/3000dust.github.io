<!-- Flight History embed for the Beyond Research page. -->
<style>
.flight-history-frame{display:block;width:100%;height:415px;border:1px solid #dce5ea;border-radius:10px;background:#fff;}
@media (max-width:600px){.flight-history-frame{height:379px;}}
</style>
<iframe
  class="flight-history-frame"
  title="Interactive flight history map"
  src="{{ '/assets/flight-history.html' | relative_url }}"
  loading="eager"
  scrolling="no"></iframe>
